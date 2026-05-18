import hashlib
from datetime import datetime, timezone

from apify import Actor

from .screenshots import dump_skip_debug, highlight, make_uuid7, save_comment_metadata, save_screenshot
from .ui import (
    expand_comment_row_text,
    expand_comments,
    fit_element_in_viewport,
    force_light_mode,
    freeze_animated_media,
    hide_visual_overlays,
    scroll_to_element,
    set_screenshot_banner,
)

# Multipart tuning knobs (keep centralized to avoid accidental regressions).
LONG_TEXT_THRESHOLD = 430
FORCED_MULTIPART_BASE = 430


def build_process_candidate(*, page, dataset, kv_store, context, comment_container, run_folder, screenshot_timeout_ms, log_every_n_screenshots, state):
    async def process_candidate(data, element_handle):
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

        if strict_key in state["seen_strict"] or loose_key in state["seen_loose"]:
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
        if comment_uid and comment_uid in state["seen_comment_uid"]:
            return False

        state["seen_strict"].add(strict_key)
        state["seen_loose"].add(loose_key)
        if comment_uid:
            state["seen_comment_uid"].add(comment_uid)

        state["count"] += 1
        state["new_in_round"] += 1
        if data.get("isGifOnly"):
            Actor.log.info(f"GIF-only comment detected: {data.get('username')} #{state["count"]}")
        await expand_comments(page, 4)
        try:
            await scroll_to_element(page, element_handle, comment_container)
        except Exception:
            pass
        await page.wait_for_timeout(350)

        try:
            # Expand long-text "more" buttons and nested replies inside this row.
            for _ in range(3):
                expanded_local = await expand_comment_row_text(page, element_handle, max_clicks=10)
                if not expanded_local:
                    break
                await page.wait_for_timeout(250)
        except Exception:
            pass

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
                f"Highlight fehlgeschlagen für Kommentar #{state["count"]} ({data.get('username')}) "
                f"reason={reason}{extra}; Screenshot wird übersprungen."
            )
            try:
                await dump_skip_debug(
                    page, kv_store, state["count"], {**data, "highlightResult": highlight_result},
                    screenshot_timeout_ms,
                )
            except Exception as dbg_exc:
                Actor.log.warning(f"dump_skip_debug failed: {dbg_exc}")
            state["count"] -= 1
            state["new_in_round"] -= 1
            state["seen_strict"].discard(strict_key)
            state["seen_loose"].discard(loose_key)
            if comment_uid:
                state["seen_comment_uid"].discard(comment_uid)
            return False
        await freeze_animated_media(page)
        await fit_element_in_viewport(page, element_handle)
        await page.wait_for_timeout(200)

        screenshot_uuid = make_uuid7()
        if log_every_n_screenshots <= 1 or state["count"] <= 5 or (state["count"] % log_every_n_screenshots == 0):
            Actor.log.info(f"Taking screenshot {state["count"]} for {context.request.url}")
        screenshot_paths: list[str] = []
        screenshot_keys: list[str] = []
        metadata_path = None
        screenshot_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        comment_permalink = data.get("commentPermalink")
        comment_url = (
            f"https://www.instagram.com{comment_permalink}"
            if isinstance(comment_permalink, str) and comment_permalink.startswith("/")
            else comment_permalink
        )

        try:
            # For very long comments, aggressively remove text clamping and
            # click local "more" controls before planning multipart shots.
            if len((data.get("text") or "")) >= LONG_TEXT_THRESHOLD:
                try:
                    await page.evaluate(
                        """
                        (el) => {
                          const row = el?.closest?.('li, [role="listitem"], article, div') || el;
                          if (!row) return;

                          const controls = Array.from(row.querySelectorAll('button, [role="button"], a, span[role="button"]'));
                          for (const c of controls) {
                            const t = (c.innerText || c.textContent || '').trim().toLowerCase();
                            if (!t) continue;
                            if (
                              t === 'more' || t === 'mehr' || t.includes('read more') || t.includes('see more') ||
                              t.includes('weiterlesen') || t.includes('mehr anzeigen') || t.includes('view more')
                            ) {
                              try { c.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); } catch (e) {}
                            }
                          }

                          const textNodes = row.querySelectorAll('span, div, p');
                          for (const n of textNodes) {
                            if (!(n instanceof HTMLElement)) continue;
                            const style = n.style;
                            style.setProperty('max-height', 'none', 'important');
                            style.setProperty('height', 'auto', 'important');
                            style.setProperty('overflow', 'visible', 'important');
                            style.setProperty('-webkit-line-clamp', 'unset', 'important');
                            style.setProperty('line-clamp', 'unset', 'important');
                          }
                        }
                        """,
                        element_handle,
                    )
                    await page.wait_for_timeout(160)
                except Exception:
                    pass

            part_plan = await page.evaluate(
                """
                ({ el, commentPermalink, userProfilePath, username, text }) => {
                  const norm = (s) => (s || '').toLowerCase().replace(/\\s+/g, ' ').trim();
                  const user = norm(username);
                  const txt = norm(text).slice(0, 180);

                  const rowFrom = (node) => node?.closest?.('li, [role="listitem"], article, div') || node;
                  let base = rowFrom(el);

                  const findByPermalink = () => {
                    if (!commentPermalink) return null;
                    const a = document.querySelector(`a[href="${commentPermalink}"]`);
                    return a ? rowFrom(a) : null;
                  };

                  const findByProfileAndText = () => {
                    if (!userProfilePath) return null;
                    const anchors = Array.from(document.querySelectorAll(`a[href="${userProfilePath}"]`));
                    for (const a of anchors) {
                      const r = rowFrom(a);
                      const content = norm(r?.innerText || '');
                      if (user && !content.includes(user)) continue;
                      if (txt && !content.includes(txt.slice(0, 80))) continue;
                      return r;
                    }
                    return anchors[0] ? rowFrom(anchors[0]) : null;
                  };

                  if (!base || !document.body.contains(base)) base = findByPermalink() || findByProfileAndText() || base;
                  if (!base) return { ok: false, mode: 'single', tops: [0], sig: null };

                  const sig = `${norm(base.querySelector('a[href^="/"]')?.getAttribute('href') || '')}|${norm(base.querySelector('time')?.getAttribute('datetime') || base.querySelector('time')?.textContent || '')}|${norm(base.innerText).slice(0, 180)}`;

                  const banner = document.getElementById('apify-screenshot-banner');
                  const bannerH = banner ? banner.getBoundingClientRect().height : 0;
                  const visibleH = Math.max(220, window.innerHeight - bannerH - 48);
                  const rowRect = base.getBoundingClientRect();
                  const rowTooTall = rowRect.height > (visibleH * 0.82);

                  const candidates = Array.from(base.querySelectorAll('*')).filter((node) => {
                    if (!(node instanceof HTMLElement)) return false;
                    const cs = window.getComputedStyle(node);
                    const overflowY = (cs.overflowY || '').toLowerCase();
                    const scrollableStyle = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
                    return scrollableStyle && (node.scrollHeight - node.clientHeight > 24) && node.clientHeight >= 60;
                  });

                  let mode = rowTooTall ? 'row' : 'single';
                  let tops = [0];

                  if (!rowTooTall && candidates.length) {
                    candidates.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight));
                    const target = candidates[0];
                    const maxScroll = Math.max(0, target.scrollHeight - target.clientHeight);
                    if (maxScroll > 24) {
                      mode = 'inner';
                      const step = Math.max(140, target.clientHeight - 40);
                      tops = [0];
                      let cur = 0;
                      while (cur < maxScroll && tops.length < 4) {
                        cur = Math.min(maxScroll, cur + step);
                        if (cur > tops[tops.length - 1]) tops.push(cur);
                      }
                    }
                  }

                  if (mode === 'row') tops = [0, 1];
                  return { ok: true, mode, tops, sig };
                }
                """,
                {
                    "el": element_handle,
                    "commentPermalink": data.get("commentPermalink"),
                    "userProfilePath": data.get("userProfilePath"),
                    "username": data.get("username"),
                    "text": data.get("text"),
                },
            )

            if not (part_plan or {}).get("ok"):
                part_plan = {"mode": "single", "tops": [0], "sig": None}

            scroll_parts = (part_plan or {}).get("tops") or [0]
            mode = (part_plan or {}).get("mode") or "single"
            base_sig = (part_plan or {}).get("sig")

            # Force multipart by text length, but cap by geometric capacity so
            # we don't generate duplicate trailing parts with identical viewport.
            text_len = len((data.get("text") or "").strip())
            if text_len >= FORCED_MULTIPART_BASE and mode == "single":
                mode = "row"
                text_parts = min(6, max(2, (text_len + (FORCED_MULTIPART_BASE - 1)) // FORCED_MULTIPART_BASE))
                geo_parts = await page.evaluate(
                    """
                    (el) => {
                      const row = el?.closest?.('li, [role="listitem"], article, div') || el;
                      if (!row) return 2;
                      const r = row.getBoundingClientRect();
                      const banner = document.getElementById('apify-screenshot-banner');
                      const bannerH = banner ? banner.getBoundingClientRect().height : 0;
                      const minTop = 24;
                      const maxBottom = window.innerHeight - bannerH - 24;
                      const visibleH = Math.max(220, maxBottom - minTop);
                      const overlapPx = Math.max(140, Math.min(260, Math.round(visibleH * 0.35)));
                      const effectiveStep = Math.max(120, visibleH - overlapPx);
                      const needed = Math.max(2, Math.ceil(Math.max(0, r.height - visibleH) / effectiveStep) + 1);
                      return Math.min(6, needed);
                    }
                    """,
                    element_handle,
                )
                forced_parts = max(2, text_parts)
                scroll_parts = list(range(forced_parts))
                Actor.log.info(
                    f"Forced multipart for long text #{state['count']} (len={text_len}) -> mode=row, parts={forced_parts}"
                )

            total_parts = max(1, len(scroll_parts))
            if total_parts > 1:
                Actor.log.info(
                    f"Multipart plan for #{state['count']}: mode={mode}, parts={total_parts}"
                )

            prev_row_top = None
            prev_row_bottom = None
            for part_idx, part_top in enumerate(scroll_parts, start=1):
                verify = await page.evaluate(
                    """
                    ({ el, commentContainer, mode, top, part, totalParts, commentPermalink, userProfilePath, username, text, baseSig }) => {
                      const norm = (s) => (s || '').toLowerCase().replace(/\\s+/g, ' ').trim();
                      const user = norm(username);
                      const txt = norm(text).slice(0, 180);
                      const rowFrom = (node) => node?.closest?.('li, [role="listitem"], article, div') || node;

                      const findRow = () => {
                        if (commentPermalink) {
                          const a = document.querySelector(`a[href="${commentPermalink}"]`);
                          if (a) return rowFrom(a);
                        }
                        if (userProfilePath) {
                          const anchors = Array.from(document.querySelectorAll(`a[href="${userProfilePath}"]`));
                          for (const a of anchors) {
                            const r = rowFrom(a);
                            const content = norm(r?.innerText || '');
                            if (user && !content.includes(user)) continue;
                            if (txt && !content.includes(txt.slice(0, 80))) continue;
                            return r;
                          }
                          if (anchors[0]) return rowFrom(anchors[0]);
                        }
                        return rowFrom(el);
                      };

                      const row = findRow();
                      if (!row || !document.body.contains(row)) return { ok: false, reason: 'row_not_found' };

                      const sig = `${norm(row.querySelector('a[href^="/"]')?.getAttribute('href') || '')}|${norm(row.querySelector('time')?.getAttribute('datetime') || row.querySelector('time')?.textContent || '')}|${norm(row.innerText).slice(0, 180)}`;
                      if (baseSig && sig && baseSig.split('|').slice(0,2).join('|') !== sig.split('|').slice(0,2).join('|')) {
                        // IG can remount rows while scrolling; continue with geometry.
                      }

                      if (mode === 'inner') {
                        const candidates = Array.from(row.querySelectorAll('*')).filter((node) => {
                          if (!(node instanceof HTMLElement)) return false;
                          const cs = window.getComputedStyle(node);
                          const overflowY = (cs.overflowY || '').toLowerCase();
                          const scrollableStyle = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
                          return scrollableStyle && (node.scrollHeight - node.clientHeight > 24) && node.clientHeight >= 60;
                        });
                        if (!candidates.length) return { ok: false, reason: 'inner_scroll_missing' };
                        candidates.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight));
                        candidates[0].scrollTop = Math.max(0, Number(top || 0));
                      } else if (mode === 'row') {
                        const parent = (() => {
                          if (commentContainer && commentContainer instanceof HTMLElement) return commentContainer;
                          let cur = row.parentElement;
                          while (cur) {
                            const cs = window.getComputedStyle(cur);
                            const oy = (cs.overflowY || '').toLowerCase();
                            const scrollable = (oy === 'auto' || oy === 'scroll' || oy === 'overlay');
                            if (scrollable && (cur.scrollHeight - cur.clientHeight > 20)) return cur;
                            cur = cur.parentElement;
                          }
                          return null;
                        })();
                        if (!parent) return { ok: false, reason: 'row_parent_missing' };

                        const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
                        const pRect = parent.getBoundingClientRect();
                        const r0 = row.getBoundingClientRect();

                        const rowTopInContent = parent.scrollTop + (r0.top - pRect.top);
                        const rowBottomInContent = rowTopInContent + r0.height;

                        const visibleH = Math.max(220, parent.clientHeight);
                        const overlapPx = Math.max(110, Math.min(180, Math.round(visibleH * 0.22)));
                        const maxScroll = Math.max(0, parent.scrollHeight - parent.clientHeight);

                        const partNum = Number(part || 1);
                        const beforeScroll = parent.scrollTop;

                        let targetScroll;
                        if (partNum <= 1) {
                          // Part 1: anchor near comment start.
                          targetScroll = rowTopInContent - 18;
                        } else {
                          // Part 2+: anchor near comment end with overlap to previous part.
                          targetScroll = rowBottomInContent - visibleH + 18 + overlapPx;
                        }

                        targetScroll = clamp(targetScroll, 0, maxScroll);
                        if (partNum > 1 && targetScroll <= beforeScroll + 8) {
                          // Never scroll upwards for later parts.
                          targetScroll = clamp(beforeScroll + Math.max(90, Math.round(visibleH * 0.18)), 0, maxScroll);
                        }
                        parent.scrollTop = targetScroll;

                        // One corrective pass using fresh geometry.
                        const r1 = row.getBoundingClientRect();
                        const rowTop2 = parent.scrollTop + (r1.top - pRect.top);
                        const rowBottom2 = rowTop2 + r1.height;
                        if (partNum <= 1) {
                          targetScroll = rowTop2 - 18;
                        } else {
                          targetScroll = rowBottom2 - visibleH + 18 + overlapPx;
                        }
                        targetScroll = clamp(targetScroll, 0, maxScroll);
                        if (partNum > 1 && targetScroll <= beforeScroll + 8) {
                          targetScroll = clamp(beforeScroll + Math.max(90, Math.round(visibleH * 0.18)), 0, maxScroll);
                        }
                        parent.scrollTop = targetScroll;
                      }

                      row.setAttribute('data-apify-active-row', '1');
                      row.setAttribute('data-apify-highlight', '1');
                      row.style.outline = '3px solid red';
                      row.style.outlineOffset = '2px';
                      row.style.boxShadow = '0 0 0 3px red inset';
                      const rr = row.getBoundingClientRect();
                      return { ok: true, rowTop: rr.top, rowBottom: rr.bottom };
                    }
                    """,
                    {
                        "el": element_handle,
                        "commentContainer": comment_container,
                        "mode": mode,
                        "top": part_top,
                        "part": part_idx,
                        "totalParts": total_parts,
                        "commentPermalink": data.get("commentPermalink"),
                        "userProfilePath": data.get("userProfilePath"),
                        "username": data.get("username"),
                        "text": data.get("text"),
                        "baseSig": base_sig,
                    },
                )

                if not (verify or {}).get("ok"):
                    Actor.log.warning(
                        f"Multipart aborted for comment #{state["count"]}: {(verify or {}).get('reason', 'verify_failed')}"
                    )
                    break

                row_top = float((verify or {}).get("rowTop") or 0)
                row_bottom = float((verify or {}).get("rowBottom") or 0)
                if part_idx > 1 and prev_row_top is not None and prev_row_bottom is not None:
                    if abs(row_top - prev_row_top) < 18 and abs(row_bottom - prev_row_bottom) < 18:
                        Actor.log.info(
                            f"Multipart part {part_idx}/{total_parts} for #{state['count']} has minimal movement; capturing anyway."
                        )

                prev_row_top = row_top
                prev_row_bottom = row_bottom

                await page.wait_for_timeout(180)
                # For row-mode multipart, keep the explicit top/bottom alignment
                # from the verify() step. Re-fitting here recenters the row and can
                # collapse both parts into the same frame.
                if mode != "row":
                    await fit_element_in_viewport(page, element_handle)
                # Re-apply highlight after scroll/re-render so each part keeps the red frame.
                rehighlight_ok = False
                try:
                    for _ in range(2):
                        hl = await highlight(page, element_handle, data)
                        if (hl or {}).get("ok"):
                            rehighlight_ok = True
                            break
                        await page.wait_for_timeout(120)
                    if not rehighlight_ok:
                        Actor.log.warning(
                            f"Re-highlight failed for #{state['count']} part {part_idx}/{total_parts}: {(hl or {}).get('reason', 'unknown')}"
                        )
                except Exception as hl_exc:
                    Actor.log.warning(f"Re-highlight exception for #{state['count']} part {part_idx}/{total_parts}: {hl_exc}")

                if not rehighlight_ok and part_idx > 1:
                    Actor.log.warning(
                        f"Skipping part {part_idx}/{total_parts} for #{state['count']} due to missing highlight."
                    )
                    continue
                await set_screenshot_banner(
                    page,
                    page.url,
                    f"{screenshot_utc} | c#{state['count']} | {screenshot_uuid[:8]} | part {part_idx}/{total_parts}",
                )

                buffer = await page.screenshot(full_page=False, timeout=screenshot_timeout_ms)
                current_hash = hashlib.sha256(buffer).hexdigest()
                if current_hash == state["last_screenshot_hash"] and not (total_parts > 1 and part_idx > 1):
                    continue

                part_suffix = "" if part_idx == 1 else f"-part{part_idx}"
                screenshot_key = f"{screenshot_uuid}{part_suffix}.png"
                await kv_store.set_value(screenshot_key, buffer, content_type="image/png")
                screenshot_path = await save_screenshot(buffer, screenshot_key, subdir=run_folder)
                screenshot_keys.append(screenshot_key)
                screenshot_paths.append(screenshot_path)
                state["last_screenshot_hash"] = current_hash

            # Fallback for tall comments: use rendered geometry, not text length.
            need_long_comment_fallback = False
            parts_target = 2
            if len(screenshot_keys) <= 1:
                try:
                    metrics = await page.evaluate(
                        """
                        (el) => {
                          const row = el?.closest?.('li, [role="listitem"], article, div') || el;
                          if (!row) return { risk: false, ratio: 1, overflowPx: 0, clippedPx: 0 };
                          const r = row.getBoundingClientRect();
                          const banner = document.getElementById('apify-screenshot-banner');
                          const bannerH = banner ? banner.getBoundingClientRect().height : 0;
                          const minTop = 20;
                          const maxBottom = window.innerHeight - bannerH - 20;
                          const visibleH = Math.max(220, maxBottom - minTop);
                          const ratio = Math.max(0, r.height / Math.max(1, visibleH));
                          const overflowPx = Math.max(0, r.height - visibleH);
                          const clippedTop = Math.max(0, minTop - r.top);
                          const clippedBottom = Math.max(0, r.bottom - maxBottom);
                          const clippedPx = clippedTop + clippedBottom;

                          const risk = overflowPx > 48 || ratio > 1.08 || clippedPx > 36;
                          return { risk, ratio, overflowPx, clippedPx };
                        }
                        """,
                        element_handle,
                    )
                    need_long_comment_fallback = bool((metrics or {}).get("risk"))
                    ratio = float((metrics or {}).get("ratio") or 1)
                    if ratio > 2.2:
                        parts_target = 4
                    elif ratio > 1.5:
                        parts_target = 3
                    else:
                        parts_target = 2
                    if need_long_comment_fallback:
                        overflow_px = int((metrics or {}).get("overflowPx") or 0)
                        clipped_px = int((metrics or {}).get("clippedPx") or 0)
                        Actor.log.info(
                            f"Tall comment detected for #{state['count']} (ratio={ratio:.2f}, overflow={overflow_px}px, clipped={clipped_px}px); using {parts_target} part(s)."
                        )
                except Exception:
                    need_long_comment_fallback = False

            if need_long_comment_fallback:
                try:
                    for tile_idx in range(1, parts_target + 1):
                        tile = await page.evaluate(
                            """
                            ({ el, commentContainer, partIndex, partsTotal, commentPermalink, userProfilePath, username, text, baseSig }) => {
                              const norm = (s) => (s || '').toLowerCase().replace(/\\s+/g, ' ').trim();
                              const user = norm(username);
                              const txt = norm(text).slice(0, 180);
                              const rowFrom = (node) => node?.closest?.('li, [role="listitem"], article, div') || node;

                              const findRow = () => {
                                if (commentPermalink) {
                                  const a = document.querySelector(`a[href="${commentPermalink}"]`);
                                  if (a) return rowFrom(a);
                                }
                                if (userProfilePath) {
                                  const anchors = Array.from(document.querySelectorAll(`a[href="${userProfilePath}"]`));
                                  for (const a of anchors) {
                                    const r = rowFrom(a);
                                    const content = norm(r?.innerText || '');
                                    if (user && !content.includes(user)) continue;
                                    if (txt && !content.includes(txt.slice(0, 80))) continue;
                                    return r;
                                  }
                                  if (anchors[0]) return rowFrom(anchors[0]);
                                }
                                return rowFrom(el);
                              };

                              const row = findRow();
                              if (!row || !document.body.contains(row)) return { ok: false, reason: 'row_not_found' };

                              const sig = `${norm(row.querySelector('a[href^="/"]')?.getAttribute('href') || '')}|${norm(row.querySelector('time')?.getAttribute('datetime') || row.querySelector('time')?.textContent || '')}|${norm(row.innerText).slice(0, 180)}`;
                              if (baseSig && sig && baseSig.split('|').slice(0,2).join('|') !== sig.split('|').slice(0,2).join('|')) {
                                // IG can remount row nodes; continue with geometry fallback.
                              }

                              const banner = document.getElementById('apify-screenshot-banner');
                              const bannerH = banner ? banner.getBoundingClientRect().height : 0;
                              const minTop = 20;
                              const maxBottom = window.innerHeight - bannerH - 20;
                              const visibleH = Math.max(220, maxBottom - minTop);

                              let r = row.getBoundingClientRect();
                              const overflow = Math.max(0, r.height - visibleH);
                              const seg = partsTotal <= 1 ? 0 : ((partIndex - 1) / (partsTotal - 1));
                              const segmentTop = Math.round(overflow * seg);
                              const desiredTop = minTop - segmentTop;

                              const parent = (() => {
                                if (commentContainer && commentContainer instanceof HTMLElement) return commentContainer;
                                let cur = row.parentElement;
                                while (cur) {
                                  if (cur.scrollHeight - cur.clientHeight > 20) return cur;
                                  cur = cur.parentElement;
                                }
                                return null;
                              })();

                              if (parent) {
                                const maxScroll = Math.max(0, parent.scrollHeight - parent.clientHeight);
                                const next = Math.max(0, Math.min(maxScroll, parent.scrollTop + (r.top - desiredTop)));
                                parent.scrollTop = next;
                              }

                              r = row.getBoundingClientRect();
                              const clipTop = Math.max(minTop, r.top - 2);
                              const clipBottom = Math.min(maxBottom, r.bottom + 2);
                              const clipLeft = Math.max(0, r.left - 4);
                              const clipRight = Math.min(window.innerWidth, r.right + 4);
                              const w = Math.max(1, clipRight - clipLeft);
                              const h = Math.max(1, clipBottom - clipTop);
                              if (h < 80 || w < 120) return { ok: false, reason: 'clip_too_small' };

                              return { ok: true, clip: { x: clipLeft, y: clipTop, width: w, height: h } };
                            }
                            """,
                            {
                                "el": element_handle,
                                "commentContainer": comment_container,
                                "partIndex": tile_idx,
                                "partsTotal": parts_target,
                                "commentPermalink": data.get("commentPermalink"),
                                "userProfilePath": data.get("userProfilePath"),
                                "username": data.get("username"),
                                "text": data.get("text"),
                                "baseSig": base_sig,
                            },
                        )

                        if not (tile or {}).get("ok"):
                            if tile_idx == 1:
                                Actor.log.warning(
                                    f"Long-comment tile fallback aborted for #{state["count"]}: {(tile or {}).get('reason', 'tile_failed')}"
                                )
                            break

                        await page.wait_for_timeout(120)
                        try:
                            await highlight(page, element_handle, data)
                        except Exception:
                            pass
                        await set_screenshot_banner(
                            page,
                            page.url,
                            f"{screenshot_utc} | c#{state['count']} | {screenshot_uuid[:8]} | element part {tile_idx}/{parts_target}",
                        )
                        clip = tile.get("clip") or {}
                        fallback_buffer = await page.screenshot(
                            full_page=False,
                            clip={
                                "x": float(clip.get("x", 0)),
                                "y": float(clip.get("y", 0)),
                                "width": float(clip.get("width", 1)),
                                "height": float(clip.get("height", 1)),
                            },
                            timeout=screenshot_timeout_ms,
                        )
                        fallback_hash = hashlib.sha256(fallback_buffer).hexdigest()
                        if fallback_hash == state["last_screenshot_hash"] and tile_idx == 1:
                            continue

                        suffix = "element" if tile_idx == 1 else f"element-part{tile_idx}"
                        fallback_key = f"{screenshot_uuid}-{suffix}.png"
                        await kv_store.set_value(fallback_key, fallback_buffer, content_type="image/png")
                        fallback_path = await save_screenshot(fallback_buffer, fallback_key, subdir=run_folder)
                        screenshot_keys.append(fallback_key)
                        screenshot_paths.append(fallback_path)
                        state["last_screenshot_hash"] = fallback_hash
                except Exception as fb_exc:
                    Actor.log.warning(f"Long-comment fallback screenshot failed for #{state["count"]}: {fb_exc}")

            if screenshot_keys:
                metadata_payload = {
                    "id": screenshot_uuid,
                    "index": state["count"],
                    "sourceUrl": context.request.url,
                    "capturedAtUtc": screenshot_utc,
                    "username": data["username"],
                    "text": data["text"],
                    "isGifOnly": bool(data.get("isGifOnly")),
                    "datetime": data.get("datetime"),
                    "timeText": data.get("timeText"),
                    "commentPermalink": comment_permalink,
                    "commentUrl": comment_url,
                    "partsTotal": len(screenshot_keys),
                    "screenshotKeys": screenshot_keys,
                }
                metadata_path = save_comment_metadata(metadata_payload, screenshot_keys[0], subdir=run_folder)
        except Exception as exc:
            Actor.log.warning(f"Screenshot failed for comment {state["count"]}: {exc}")
            await dump_skip_debug(page, kv_store, state["count"], data, screenshot_timeout_ms)

        await dataset.push_data(
            {
                "id": screenshot_uuid if screenshot_paths else None,
                "username": data["username"],
                "text": data["text"],
                "isGifOnly": bool(data.get("isGifOnly")),
                "datetime": data.get("datetime"),
                "timeText": data.get("timeText"),
                "commentPermalink": comment_permalink,
                "commentUrl": comment_url,
                "index": state["count"],
                "sourceUrl": context.request.url,
                "screenshotKey": screenshot_keys[0] if screenshot_keys else None,
                "screenshotPath": screenshot_paths[0] if screenshot_paths else None,
                "screenshotKeys": screenshot_keys,
                "screenshotPaths": screenshot_paths,
                "partsTotal": len(screenshot_keys),
                "metadataPath": metadata_path,
            }
        )
        return True

    return process_candidate
