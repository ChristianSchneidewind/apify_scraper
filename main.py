import asyncio
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

from apify import Actor
from crawlee import ConcurrencySettings
from crawlee.crawlers import PlaywrightCrawler, PlaywrightCrawlingContext
from dotenv import load_dotenv

from src.scrape_loop import run_comment_capture_loop
from src.config import parse_input
from src.errors import InputValidationError
from src.constants import SCREENSHOTS_DIR
from src.debug_tools import dump_no_comments_debug, enable_comment_network_debug
from src.page_setup import prepare_comments_page
from src.screenshots import make_post_slug
from src.session import apply_login_session, init_session_state
from src.ui import force_light_mode
from src.log_events import log_event, warn_event

load_dotenv()


async def main():
    async with Actor:
        input_data = await Actor.get_input() or {}
        cfg = parse_input(input_data)
        urls = cfg["urls"]
        if not urls:
            raise InputValidationError('Input "urls" must be a non-empty array of Instagram post URLs.')

        max_comments = cfg["max_comments"]
        max_ui_rounds = cfg["max_ui_rounds"]
        ui_idle_rounds = cfg["ui_idle_rounds"]
        load_timeout_secs = cfg["load_timeout_secs"]
        screenshot_timeout_ms = cfg["screenshot_timeout_ms"]
        request_handler_timeout_secs = cfg["request_handler_timeout_secs"]
        login_enabled = cfg["login_enabled"]
        login_username = cfg["login_username"]
        login_password = cfg["login_password"]
        login_state_key = cfg["login_state_key"]
        save_login_state = cfg["save_login_state"]
        headful = cfg["headful"]
        window_pos_x = cfg["window_pos_x"]
        window_pos_y = cfg["window_pos_y"]
        slow_mo_ms = cfg["slow_mo_ms"]
        debug_network = cfg["debug_network"]
        log_every_n_screenshots = cfg["log_every_n_screenshots"]
        debug_har = cfg["debug_har"]
        debug_devtools = cfg["debug_devtools"]
        manual_debug_mode = cfg["manual_debug_mode"]
        manual_debug_only = cfg["manual_debug_only"]
        manual_debug_pause_secs = cfg["manual_debug_pause_secs"]
        force_single_concurrency = cfg["force_single_concurrency"]
        no_new_rounds_before_rescan = cfg["no_new_rounds_before_rescan"]
        max_rescan_passes = cfg["max_rescan_passes"]
        max_comment_likers = cfg["max_comment_likers"]
        liker_collection_mode = cfg["liker_collection_mode"]
        log_event(
            "config.effective",
            max_comment_likers=max_comment_likers,
            liker_collection_mode=liker_collection_mode,
            urls_count=len(urls),
            login_enabled=login_enabled,
        )

        dataset = await Actor.open_dataset()
        kv_store = await Actor.open_key_value_store()
        meta_store = await Actor.open_key_value_store(name="video_meta")

        SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
        run_started_at = datetime.now(timezone.utc)
        run_id = run_started_at.strftime("%Y%m%dT%H%M%SZ")

        stored_state = await kv_store.get_value(login_state_key) if login_enabled else None
        viewport_width = cfg["viewport_width"]
        viewport_height = cfg["viewport_height"]
        maximize_window = cfg["maximize_window"]

        browser_new_context_options = {
            "color_scheme": "light",
            "viewport": {"width": viewport_width, "height": viewport_height},
            "screen": {"width": viewport_width, "height": viewport_height},
        }
        if debug_har:
            browser_new_context_options["record_har_path"] = str(Path.cwd() / "storage" / "instagram-debug.har")
            browser_new_context_options["record_har_content"] = "embed"
            browser_new_context_options["record_har_mode"] = "full"

        launch_args = [
            "--no-sandbox",
            f"--window-position={window_pos_x},{window_pos_y}",
        ]
        if headful and maximize_window:
            launch_args.append("--start-maximized")
        else:
            launch_args.append(f"--window-size={viewport_width},{viewport_height}")

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
                "args": launch_args,
                "slow_mo": slow_mo_ms,
                "devtools": bool(debug_devtools),
            },
            browser_new_context_options=browser_new_context_options,
            request_handler_timeout=timedelta(seconds=request_handler_timeout_secs),
        )

        session_state = init_session_state(stored_state)
        run_summary = {
            "urls_total": len(urls),
            "urls_processed": 0,
            "comments_captured_total": 0,
            "likers_collected_total": 0,
            "comment_processing_ms_total": 0,
            "zero_comment_urls": 0,
            "errors": 0,
        }

        @crawler.router.default_handler
        async def request_handler(context: PlaywrightCrawlingContext) -> None:
            page = context.page

            if debug_network:
                enable_comment_network_debug(page, kv_store)

            await apply_login_session(
                page=page,
                kv_store=kv_store,
                session_state=session_state,
                login_enabled=login_enabled,
                login_username=login_username,
                login_password=login_password,
                login_state_key=login_state_key,
                save_login_state=save_login_state,
                screenshot_timeout_ms=screenshot_timeout_ms,
            )

            await force_light_mode(page)
            target_url = context.request.url.replace('/reels/', '/reel/')
            await page.goto(target_url, wait_until="domcontentloaded")

            if manual_debug_mode:
                log_event("request.manual_debug_mode", pause_secs=manual_debug_pause_secs, target_url=target_url)
                await page.wait_for_timeout(manual_debug_pause_secs * 1000)
                if manual_debug_only:
                    log_event("request.manual_debug_only_skip")
                    return

            await prepare_comments_page(
                page=page,
                max_ui_rounds=max_ui_rounds,
                ui_idle_rounds=ui_idle_rounds,
                load_timeout_secs=load_timeout_secs,
            )

            post_slug = make_post_slug(context.request.url)
            run_folder = f"{post_slug}/{run_id}"
            video_meta_key = f"VIDEO_META::{post_slug}"

            video_meta = await meta_store.get_value(video_meta_key) or {
                "postSlug": post_slug,
                "sourceUrl": context.request.url,
                "firstSeenAt": datetime.now(timezone.utc).isoformat(),
                "totalCaptured": 0,
            }

            url_started_at = datetime.now(timezone.utc)
            url_stats = {"comments_processed": 0, "likers_collected_total": 0}
            count = await run_comment_capture_loop(
                page=page,
                context=context,
                dataset=dataset,
                kv_store=kv_store,
                run_folder=run_folder,
                screenshot_timeout_ms=screenshot_timeout_ms,
                log_every_n_screenshots=log_every_n_screenshots,
                max_comments=max_comments,
                max_ui_rounds=max_ui_rounds,
                ui_idle_rounds=ui_idle_rounds,
                no_new_rounds_before_rescan=no_new_rounds_before_rescan,
                max_rescan_passes=max_rescan_passes,
                max_comment_likers=max_comment_likers,
                liker_collection_mode=liker_collection_mode,
                stats=url_stats,
            )

            if count == 0:
                await dump_no_comments_debug(page, kv_store, screenshot_timeout_ms)

            run_summary["urls_processed"] += 1
            run_summary["comments_captured_total"] += int(count or 0)
            run_summary["likers_collected_total"] = int(run_summary.get("likers_collected_total", 0)) + int(url_stats.get("likers_collected_total", 0))
            elapsed_url_ms = int((datetime.now(timezone.utc) - url_started_at).total_seconds() * 1000)
            run_summary["comment_processing_ms_total"] = int(run_summary.get("comment_processing_ms_total", 0)) + elapsed_url_ms
            if count == 0:
                run_summary["zero_comment_urls"] += 1

            log_event("request.captured", count=count, source_url=context.request.url)
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
            run_summary["errors"] += 1
            message = str(exc)
            if "Target page, context or browser has been closed" in message:
                warn_event("crawler.shutdown_warning_ignored", message=message)
            else:
                raise
        finally:
            finished_at = datetime.now(timezone.utc)
            elapsed_secs = int((finished_at - run_started_at).total_seconds())
            comments_total = int(run_summary.get("comments_captured_total", 0))
            avg_comment_ms = int(run_summary.get("comment_processing_ms_total", 0) / comments_total) if comments_total else 0
            avg_likers_per_comment = round(float(run_summary.get("likers_collected_total", 0)) / comments_total, 2) if comments_total else 0.0
            summary_payload = {
                "runId": run_id,
                "urlsTotal": run_summary["urls_total"],
                "urlsProcessed": run_summary["urls_processed"],
                "commentsCapturedTotal": comments_total,
                "likersCollectedTotal": run_summary["likers_collected_total"],
                "avgCommentMs": avg_comment_ms,
                "avgLikersPerComment": avg_likers_per_comment,
                "zeroCommentUrls": run_summary["zero_comment_urls"],
                "errors": run_summary["errors"],
                "elapsedSecs": elapsed_secs,
                "finishedAt": finished_at.isoformat(),
            }

            log_event(
                "run.summary",
                run_id=run_id,
                urls_total=run_summary["urls_total"],
                urls_processed=run_summary["urls_processed"],
                comments_captured_total=comments_total,
                likers_collected_total=run_summary["likers_collected_total"],
                avg_comment_ms=avg_comment_ms,
                avg_likers_per_comment=avg_likers_per_comment,
                zero_comment_urls=run_summary["zero_comment_urls"],
                errors=run_summary["errors"],
                elapsed_secs=elapsed_secs,
            )

            try:
                await kv_store.set_value(f"RUN_SUMMARY::{run_id}", summary_payload, content_type="application/json")
            except Exception as exc:
                warn_event("run.summary.persist_kv_failed", error=str(exc))

            try:
                summary_dir = SCREENSHOTS_DIR / "_run_summaries"
                summary_dir.mkdir(parents=True, exist_ok=True)
                (summary_dir / f"{run_id}.json").write_text(
                    json.dumps(summary_payload, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
            except Exception as exc:
                warn_event("run.summary.persist_file_failed", error=str(exc))


if __name__ == "__main__":
    asyncio.run(main())
