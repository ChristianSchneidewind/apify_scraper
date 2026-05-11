import asyncio
import hashlib
import json
import os
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

from apify import Actor
from crawlee import ConcurrencySettings
from crawlee.crawlers import PlaywrightCrawler, PlaywrightCrawlingContext
from dotenv import load_dotenv

from src.auth import dismiss_login_wall, ensure_logged_in, handle_cookie_banner
from src.comments import extract_comment_from_item, extract_comment_from_time, get_dialog_comment_rows, get_post_comment_rows
from src.constants import SCREENSHOTS_DIR, VIEWPORT_HEIGHT, VIEWPORT_WIDTH
from src.screenshots import dump_skip_debug, highlight, make_post_slug, make_uuid7, save_comment_metadata, save_screenshot
from src.ui import (
    auto_scroll,
    expand_comments,
    force_light_mode,
    freeze_animated_media,
    get_comment_container,
    hide_visual_overlays,
    load_all_comments,
    open_comments_panel,
    scroll_to_element,
    set_screenshot_banner,
)

load_dotenv()


async def main():
    async with Actor:
        input_data = await Actor.get_input() or {}
        urls = input_data.get("urls", [])
        if not urls:
            raise RuntimeError('Input "urls" must be a non-empty array of Instagram post URLs.')

        max_comments = input_data.get("maxComments") or 0
        max_ui_rounds = input_data.get("maxUiRounds", 120)
        ui_idle_rounds = input_data.get("uiIdleRounds", 15)
        load_timeout_secs = input_data.get("loadTimeoutSecs", 180)
        screenshot_timeout_ms = int(input_data.get("screenshotTimeoutSecs", 60) * 1000)
        request_handler_timeout_secs = int(input_data.get("requestHandlerTimeoutSecs", 7200))
        login_enabled = input_data.get("loginEnabled", False)
        login_username = input_data.get("loginUsername") or os.getenv("INSTAGRAM_USERNAME")
        login_password = input_data.get("loginPassword") or os.getenv("INSTAGRAM_PASSWORD")
        login_state_key = input_data.get("loginStateKey", "LOGIN_STATE")
        save_login_state = input_data.get("saveLoginState", True)
        headful = input_data.get("headful", False)
        slow_mo_ms = int(input_data.get("slowMoMs", 0))
        debug_network = bool(input_data.get("debugNetwork", False))
        debug_har = bool(input_data.get("debugHar", False))
        debug_devtools = bool(input_data.get("debugDevtools", False))
        manual_debug_mode = bool(input_data.get("manualDebugMode", False))
        manual_debug_only = bool(input_data.get("manualDebugOnly", False))
        manual_debug_pause_secs = int(input_data.get("manualDebugPauseSecs", 180))
        force_single_concurrency = bool(input_data.get("forceSingleConcurrency", True))
        no_new_rounds_before_rescan = int(input_data.get("noNewRoundsBeforeRescan", 5))
        max_rescan_passes = int(input_data.get("maxRescanPasses", 3))

        dataset = await Actor.open_dataset()
        kv_store = await Actor.open_key_value_store()
        meta_store = await Actor.open_key_value_store(name="video_meta")

        SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
        run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

        stored_state = await kv_store.get_value(login_state_key) if login_enabled else None
        browser_new_context_options = {
            "color_scheme": "light",
            "viewport": {"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT},
            "screen": {"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT},
        }
        if debug_har:
            browser_new_context_options["record_har_path"] = str(Path.cwd() / "storage" / "instagram-debug.har")
            browser_new_context_options["record_har_content"] = "embed"
            browser_new_context_options["record_har_mode"] = "full"

        crawler = PlaywrightCrawler(
            max_requests_per_crawl=len(urls),
            max_request_retries=0,
            concurrency_settings=ConcurrencySettings(
                min_concurrency=1,
                max_concurrency=1 if force_single_concurrency else 3,
                desired_concurrency=1 if force_single_concurrency else None,
            ),
            headless=not headful,
            browser_type="chromium",
            browser_launch_options={
                "chromium_sandbox": False,
                "args": ["--no-sandbox", f"--window-size={VIEWPORT_WIDTH},{VIEWPORT_HEIGHT}"],
                "slow_mo": slow_mo_ms,
                "devtools": bool(debug_devtools),
            },
            browser_new_context_options=browser_new_context_options,
            request_handler_timeout=timedelta(seconds=request_handler_timeout_secs),
        )

        login_done = False
        cookies_loaded = False
        stored_state_data = stored_state

        @crawler.router.default_handler
        async def request_handler(context: PlaywrightCrawlingContext) -> None:
            nonlocal login_done
            page = context.page

            if debug_network:
                def _short(s, n=300):
                    return (s[:n] + "…") if s and len(s) > n else s

                def _schedule_debug_task(coro):
                    task = asyncio.create_task(coro)

                    def _log_task_result(t: asyncio.Task) -> None:
                        if t.cancelled():
                            return
                        exc = t.exception()
                        if exc:
                            Actor.log.warning(f"[COMMENTS-DEBUG] background task failed: {exc}")

                    task.add_done_callback(_log_task_result)

                saved_comment_responses = {"count": 0}
                comment_query_names = {
                    "PolarisPostCommentsContainerQuery",
                    "PolarisClipsDesktopCommentsPopoverQuery",
                    "PolarisPostCommentsPaginationQuery",
                    "PolarisPostChildCommentsQuery",
                }
                comment_doc_ids = {
                    "26113520058347588",
                    "26591948213770017",
                    "25516980651312394",
                    "34884685271179117",
                    "17953756669066153",
                }

                async def on_request(request):
                    try:
                        url = request.url
                        post_data = request.post_data or ""
                        has_comment_hint = (
                            "comment" in url.lower()
                            or "comment" in post_data.lower()
                            or any(name in post_data for name in comment_query_names)
                            or any(doc in post_data for doc in comment_doc_ids)
                            or any(doc in url for doc in comment_doc_ids)
                        )
                        if not has_comment_hint:
                            return
                        saved_comment_responses["count"] += 1
                        idx = saved_comment_responses["count"]
                        key = f"debug-comments-req-{idx:03d}.json"
                        payload = {
                            "index": idx,
                            "url": url,
                            "method": request.method,
                            "postData": post_data,
                        }
                        await kv_store.set_value(key, json.dumps(payload, indent=2), content_type="application/json")
                        Actor.log.info(f"[COMMENTS-DEBUG] saved {key}")
                    except Exception as exc:
                        Actor.log.warning(f"[COMMENTS-DEBUG] request save failed: {exc}")

                async def on_response(response):
                    url = response.url
                    body = None
                    if "instagram.com/api" in url or "/graphql/" in url or "comments" in url:
                        try:
                            body = await response.text()
                        except Exception:
                            body = "<no body>"
                        Actor.log.info(f"[RESP] {response.status} {url} body={_short(body)}")

                    try:
                        req = response.request
                        post_data = req.post_data or ""
                        is_comment_query = (
                            "comment" in url.lower()
                            or "comment" in post_data.lower()
                            or any(name in post_data for name in comment_query_names)
                            or any(doc in post_data for doc in comment_doc_ids)
                            or any(doc in url for doc in comment_doc_ids)
                        )
                        if not is_comment_query:
                            return

                        saved_comment_responses["count"] += 1
                        idx = saved_comment_responses["count"]
                        if body is None:
                            try:
                                body = await response.text()
                            except Exception:
                                body = "<no body>"
                        payload = {
                            "index": idx,
                            "status": response.status,
                            "url": url,
                            "method": req.method,
                            "postData": post_data,
                            "body": body if isinstance(body, str) else "<non-text body>",
                        }
                        key = f"debug-comments-resp-{idx:03d}.json"
                        await kv_store.set_value(key, json.dumps(payload, indent=2), content_type="application/json")
                        Actor.log.info(f"[COMMENTS-DEBUG] saved {key}")
                    except Exception as exc:
                        Actor.log.warning(f"[COMMENTS-DEBUG] response save failed: {exc}")

                page.on("request", lambda r: _schedule_debug_task(on_request(r)))
                page.on("response", lambda r: _schedule_debug_task(on_response(r)))

            nonlocal cookies_loaded, stored_state_data

            if stored_state_data and not cookies_loaded:
                cookies = stored_state_data.get("cookies", [])
                if cookies:
                    await page.context.add_cookies(cookies)
                cookies_loaded = True

            if login_enabled and not login_done:
                browser_context = page.context
                login_page = await browser_context.new_page()
                await ensure_logged_in(login_page, kv_store, login_username, login_password, screenshot_timeout_ms)
                if save_login_state:
                    storage_state = await browser_context.storage_state()
                    await kv_store.set_value(login_state_key, storage_state, content_type="application/json")
                    stored_state_data = storage_state
                await login_page.close()
                login_done = True

            await force_light_mode(page)
            target_url = context.request.url.replace('/reels/', '/reel/')
            await page.goto(target_url, wait_until="domcontentloaded")

            if manual_debug_mode:
                Actor.log.info(
                    f"Manual debug mode active: {manual_debug_pause_secs}s control for user on {target_url}"
                )
                await page.wait_for_timeout(manual_debug_pause_secs * 1000)
                if manual_debug_only:
                    Actor.log.info("Manual debug only active: skipping scraper after pause.")
                    return

            await force_light_mode(page)
            await handle_cookie_banner(page)
            await dismiss_login_wall(page)

            await force_light_mode(page)
            await open_comments_panel(page)
            await dismiss_login_wall(page)
            if await page.eval_on_selector_all("time", "nodes => nodes.length") == 0:
                await open_comments_panel(page)
            try:
                await asyncio.wait_for(
                    load_all_comments(page, max_ui_rounds, ui_idle_rounds),
                    timeout=load_timeout_secs,
                )
            except Exception as exc:
                Actor.log.warning(f"load_all_comments timeout or error: {exc}")
            await auto_scroll(page, 8)
            await page.wait_for_timeout(1500)
            await dismiss_login_wall(page)

            await expand_comments(page, 30)
            comment_container = await get_comment_container(page)

            # Start screenshotting from the top-most visible comments.
            try:
                await page.evaluate(
                    """
                    (container) => {
                      if (container) container.scrollTop = 0;
                      window.scrollTo(0, 0);
                    }
                    """,
                    comment_container,
                )
                await page.wait_for_timeout(500)
            except Exception:
                pass

            post_slug = make_post_slug(context.request.url)
            run_folder = f"{post_slug}/{run_id}"
            video_meta_key = f"VIDEO_META::{post_slug}"

            video_meta = await meta_store.get_value(video_meta_key) or {
                "postSlug": post_slug,
                "sourceUrl": context.request.url,
                "firstSeenAt": datetime.now(timezone.utc).isoformat(),
                "totalCaptured": 0,
            }

            # Jeder Lauf startet frisch: keine Persistenz von Kommentar-Hashes
            # zwischen Läufen. Die seen_* Sets verhindern nur innerhalb des
            # aktuellen Laufs doppelte Screenshots desselben Kommentars.
            count = 0
            seen_strict: set[str] = set()
            seen_loose: set[str] = set()
            seen_visual: set[str] = set()
            seen_comment_uid: set[str] = set()
            idle = 0
            stale_rounds = 0
            rescan_passes = 0
            last_screenshot_hash: str | None = None

            for round_idx in range(max_ui_rounds):
                comment_container = await get_comment_container(page)
                await expand_comments(page, 30)
                is_post_page = "/p/" in context.request.url
                row_handles = await (get_post_comment_rows(page) if is_post_page else get_dialog_comment_rows(page))
                # Earlier post-page selectors missed IG's current markup where
                # comment <time> nodes no longer live under `main article` / `li`.
                # Use the broad selector for both layouts; the actual scraping uses
                # row_handles, this counter is purely diagnostic.
                time_sel = 'div[role="dialog"] time, article time, li time, time'
                time_handles = await page.query_selector_all(time_sel)
                Actor.log.info(
                    f"Round {round_idx + 1}: {len(row_handles)} comment rows, "
                    f"{len(time_handles)} time nodes (post_page={is_post_page})"
                )

                new_in_round = 0

                async def process_candidate(data, element_handle):
                    nonlocal count, new_in_round, last_screenshot_hash
                    if not data or not element_handle:
                        return False

                    username = (data.get('username') or '').strip().lower()
                    text = (data.get('text') or '').strip().lower()
                    dt = (data.get('datetime') or '').strip().lower()
                    tt = (data.get('timeText') or '').strip().lower()
                    is_gif = bool(data.get('isGifOnly'))

                    strict_key = f"{username}|{text}|{dt}"
                    if is_gif:
                        loose_key = f"gif|{username}|{tt or dt}"
                    else:
                        loose_key = f"txt|{username}|{text}|{tt or dt}"

                    if strict_key in seen_strict or loose_key in seen_loose:
                        return False

                    comment_uid = await page.evaluate(
                        """
                        (el) => {
                          const row = el?.closest?.('li, [role="listitem"], article') || el;
                          if (!row) return null;
                          const profileHref = row.querySelector('a[href^="/"]')?.getAttribute('href') || '';
                          const timeEl = row.querySelector('time');
                          const dt = timeEl?.getAttribute('datetime') || '';
                          const tt = (timeEl?.textContent || '').trim().toLowerCase();
                          const txt = (row.innerText || '').replace(/\\s+/g, ' ').trim().toLowerCase();
                          const txtSig = txt.slice(0, 120);
                          const mediaSig = Array.from(row.querySelectorAll('img,video,canvas'))
                            .map((n) => (n.getAttribute?.('src') || n.getAttribute?.('poster') || n.getAttribute?.('alt') || n.tagName || '').toLowerCase())
                            .filter(Boolean)
                            .slice(0, 2)
                            .join('|');
                          return `${profileHref}|${dt || tt}|${txtSig}|${mediaSig}`;
                        }
                        """,
                        element_handle,
                    )
                    if comment_uid and comment_uid in seen_comment_uid:
                        return False

                    visual_key = await page.evaluate(
                        """
                        (el) => {
                          const row = el?.closest?.('li, [role="listitem"], article') || el;
                          if (!row) return null;
                          const r = row.getBoundingClientRect();
                          const txt = (row.innerText || '').replace(/\\s+/g, ' ').trim().toLowerCase().slice(0, 220);
                          const t = row.querySelector('time')?.getAttribute('datetime') || row.querySelector('time')?.textContent || '';
                          return `${Math.round(r.top)}|${Math.round(r.height)}|${t}|${txt}`;
                        }
                        """,
                        element_handle,
                    )
                    # visual_key is kept for diagnostics only (not hard dedup)

                    seen_strict.add(strict_key)
                    seen_loose.add(loose_key)
                    if comment_uid:
                        seen_comment_uid.add(comment_uid)
                    if visual_key:
                        seen_visual.add(visual_key)

                    count += 1
                    new_in_round += 1
                    if data.get("isGifOnly"):
                        Actor.log.info(f"GIF-only comment detected: {data.get('username')} #{count}")
                    await expand_comments(page, 4)
                    try:
                        await scroll_to_element(page, element_handle, comment_container)
                    except Exception:
                        pass
                    await page.wait_for_timeout(350)

                    await force_light_mode(page)
                    await hide_visual_overlays(page)
                    highlight_result = {"ok": False, "reason": "not_attempted"}
                    for _hl in range(3):
                        highlight_result = await highlight(page, element_handle, data)
                        if highlight_result.get("ok"):
                            break
                        await page.wait_for_timeout(200)
                        try:
                            await scroll_to_element(page, element_handle, comment_container)
                        except Exception:
                            pass
                        await page.wait_for_timeout(250)
                    if not highlight_result.get("ok"):
                        reason = highlight_result.get("reason", "unknown")
                        extra = ""
                        rect = highlight_result.get("rect")
                        if rect:
                            extra = f" rect={rect}"
                        if highlight_result.get("detachedFallbackUsed"):
                            extra += " (fallback used)"
                        Actor.log.warning(
                            f"Highlight fehlgeschlagen für Kommentar #{count} ({data.get('username')}) "
                            f"reason={reason}{extra}; Screenshot wird übersprungen."
                        )
                        try:
                            await dump_skip_debug(
                                page, kv_store, count, {**data, "highlightResult": highlight_result},
                                screenshot_timeout_ms,
                            )
                        except Exception as dbg_exc:
                            Actor.log.warning(f"dump_skip_debug failed: {dbg_exc}")
                        count -= 1
                        new_in_round -= 1
                        seen_strict.discard(strict_key)
                        seen_loose.discard(loose_key)
                        if comment_uid:
                            seen_comment_uid.discard(comment_uid)
                        if visual_key:
                            seen_visual.discard(visual_key)
                        return False
                    await freeze_animated_media(page)

                    screenshot_uuid = make_uuid7()
                    screenshot_key = f"{screenshot_uuid}.png"
                    Actor.log.info(f"Taking screenshot {count} for {context.request.url}")
                    screenshot_path = None
                    metadata_path = None
                    screenshot_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
                    try:
                        await set_screenshot_banner(page, page.url, screenshot_utc)
                        # Viewport-only: full_page=True würde Playwright zwingen, das
                        # Viewport auf die ganze Dokumenthöhe zu vergrössern. Instagram
                        # reflowt dann (Post-Bild wird grösser) und der virtualisierte
                        # Kommentar-Container unmountet alle Kommentare ausser den
                        # obersten ~3 – egal welche Zeile wir markiert haben.
                        # scroll_to_element() hat den markierten Kommentar bereits
                        # zentriert, der Banner ist fixed, also reicht ein
                        # viewport screenshot.
                        buffer = await page.screenshot(full_page=False, timeout=screenshot_timeout_ms)
                        current_hash = hashlib.sha256(buffer).hexdigest()
                        if current_hash == last_screenshot_hash:
                            Actor.log.warning(f"Duplicate screenshot detected for comment {count}; skipping image save.")
                        else:
                            await kv_store.set_value(screenshot_key, buffer, content_type="image/png")
                            screenshot_path = await save_screenshot(buffer, screenshot_key, subdir=run_folder)
                            metadata_payload = {
                                "id": screenshot_uuid,
                                "index": count,
                                "sourceUrl": context.request.url,
                                "capturedAtUtc": screenshot_utc,
                                "username": data["username"],
                                "text": data["text"],
                                "isGifOnly": bool(data.get("isGifOnly")),
                                "datetime": data.get("datetime"),
                                "timeText": data.get("timeText"),
                            }
                            metadata_path = save_comment_metadata(metadata_payload, screenshot_key, subdir=run_folder)
                            last_screenshot_hash = current_hash
                    except Exception as exc:
                        Actor.log.warning(f"Screenshot failed for comment {count}: {exc}")
                        await dump_skip_debug(page, kv_store, count, data, screenshot_timeout_ms)

                    await dataset.push_data(
                        {
                            "id": screenshot_uuid if screenshot_path else None,
                            "username": data["username"],
                            "text": data["text"],
                            "isGifOnly": bool(data.get("isGifOnly")),
                            "datetime": data.get("datetime"),
                            "timeText": data.get("timeText"),
                            "index": count,
                            "sourceUrl": context.request.url,
                            "screenshotKey": screenshot_key if screenshot_path else None,
                            "screenshotPath": screenshot_path,
                            "metadataPath": metadata_path,
                        }
                    )
                    return True

                for row_handle in row_handles:
                    data, element_handle = await extract_comment_from_item(row_handle)
                    await process_candidate(data, element_handle)
                    if max_comments and count >= max_comments:
                        break

                if (not max_comments or count < max_comments) and new_in_round == 0:
                    for time_handle in time_handles:
                        data, element_handle = await extract_comment_from_time(time_handle)
                        await process_candidate(data, element_handle)
                        if max_comments and count >= max_comments:
                            break

                if max_comments and count >= max_comments:
                    break

                if new_in_round == 0:
                    idle += 1
                    stale_rounds += 1
                else:
                    idle = 0
                    stale_rounds = 0

                if stale_rounds >= no_new_rounds_before_rescan and rescan_passes < max_rescan_passes:
                    Actor.log.info(
                        f"No new comments for {stale_rounds} rounds. Starting rescan pass {rescan_passes + 1}/{max_rescan_passes}."
                    )
                    try:
                        await asyncio.wait_for(load_all_comments(page, 60, 8), timeout=240)
                    except Exception as exc:
                        Actor.log.warning(f"rescan load_all_comments warning: {exc}")

                    comment_container = await get_comment_container(page)
                    try:
                        await page.evaluate(
                            """
                            (container) => {
                              if (container) container.scrollTop = 0;
                              window.scrollTo(0, 0);
                            }
                            """,
                            comment_container,
                        )
                        await page.wait_for_timeout(1500)
                    except Exception:
                        pass
                    await open_comments_panel(page)
                    await dismiss_login_wall(page)
                    await expand_comments(page, 40)
                    stale_rounds = 0
                    idle = 0
                    rescan_passes += 1
                    continue

                if idle >= ui_idle_rounds:
                    break

                scrolled = await page.evaluate(
                    """
                    (container) => {
                      if (!container) {
                        const isReel = /\\/reels?\\//.test(location.pathname);
                        if (isReel) return false;
                        const before = window.scrollY;
                        window.scrollBy(0, window.innerHeight * 0.8);
                        return Math.abs(window.scrollY - before) > 10;
                      }
                      const before = container.scrollTop;
                      container.scrollTop += container.clientHeight * 0.8;
                      return Math.abs(container.scrollTop - before) > 10;
                    }
                    """,
                    comment_container,
                )

                if not scrolled:
                    idle += 1

                await page.wait_for_timeout(1200)

            if count == 0:
                debug_stamp = int(time.time_ns() // 1_000_000)
                debug_key = f"debug-{debug_stamp}.png"
                debug_buffer = await page.screenshot(full_page=True, timeout=screenshot_timeout_ms)
                await kv_store.set_value(debug_key, debug_buffer, content_type="image/png")
                html_key = f"debug-{debug_stamp}-page.html"
                html = await page.content()
                await kv_store.set_value(html_key, html, content_type="text/html")

                time_samples = await page.eval_on_selector_all("time", "nodes => nodes.slice(0, 5).map(node => node.outerHTML)")
                container_samples = await page.eval_on_selector_all(
                    "time",
                    """
                    nodes => nodes.slice(0, 3).map(node => {
                      let current = node.parentElement;
                      const results = [];
                      for (let i = 0; i < 4 && current; i += 1) {
                        results.push(current.outerHTML.slice(0, 800));
                        current = current.parentElement;
                      }
                      return { time: node.outerHTML, ancestors: results };
                    })
                    """,
                )
                sample_key = f"debug-{debug_stamp}-samples.json"
                await kv_store.set_value(sample_key, json.dumps({"timeSamples": time_samples, "containerSamples": container_samples}, indent=2), content_type="application/json")

                Actor.log.warning(
                    f"No comments found. Saved debug screenshot {debug_key}, HTML {html_key}, samples {sample_key}"
                )

            Actor.log.info(f"Captured {count} comments for {context.request.url}")
            finished_at = datetime.now(timezone.utc).isoformat()

            video_meta.update(
                {
                    "sourceUrl": context.request.url,
                    "lastRunId": run_id,
                    "lastRunAt": finished_at,
                    "lastRunCount": count,
                    "totalCaptured": max(int(video_meta.get("totalCaptured", 0) or 0), count),
                    "screenshotBaseDir": str((SCREENSHOTS_DIR / post_slug).resolve()),
                }
            )
            await meta_store.set_value(video_meta_key, video_meta, content_type="application/json")

        try:
            await crawler.run(urls)
        except Exception as exc:
            message = str(exc)
            if "Target page, context or browser has been closed" in message:
                Actor.log.warning(f"Crawler shutdown warning ignored: {message}")
            else:
                raise


if __name__ == "__main__":
    asyncio.run(main())
