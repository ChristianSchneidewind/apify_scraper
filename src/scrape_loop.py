import asyncio

from .auth import dismiss_login_wall
from .log_events import log_event, warn_event
from .comment_processor import build_process_candidate
from .comments import extract_comment_from_item, extract_comment_from_time, get_dialog_comment_rows, get_post_comment_rows
from .instagram_dom import COMMENT_TIME_SELECTOR
from .ui import expand_all_reply_threads, expand_comments, get_comment_container, load_all_comments, open_comments_panel


async def run_comment_capture_loop(
    *,
    page,
    context,
    dataset,
    kv_store,
    run_folder: str,
    screenshot_timeout_ms: int,
    log_every_n_screenshots: int,
    max_comments: int,
    max_ui_rounds: int,
    ui_idle_rounds: int,
    no_new_rounds_before_rescan: int,
    max_rescan_passes: int,
    max_comment_likers: int,
    liker_collection_mode: str = "best_effort",
    safe_interaction_mode: bool = False,
    stats: dict | None = None,
) -> int:
    count = 0
    seen_strict: set[str] = set()
    seen_loose: set[str] = set()
    seen_comment_uid: set[str] = set()
    idle = 0
    stale_rounds = 0
    rescan_passes = 0
    no_gain_after_rescan = False
    last_screenshot_hash: str | None = None
    qa_state = stats.setdefault("dataset_qa", {}) if isinstance(stats, dict) else None

    for round_idx in range(max_ui_rounds):
        comment_container = await get_comment_container(page)
        await expand_comments(page, 30, safe_mode=safe_interaction_mode)
        try:
            await expand_all_reply_threads(page, max_clicks=20 if safe_interaction_mode else 100)
        except Exception:
            pass

        is_post_page = "/p/" in context.request.url
        row_handles = await (get_post_comment_rows(page) if is_post_page else get_dialog_comment_rows(page))
        time_handles = await page.query_selector_all(COMMENT_TIME_SELECTOR)
        log_event(
            "scrape.round",
            round=round_idx + 1,
            rows=len(row_handles),
            time_nodes=len(time_handles),
            post_page=is_post_page,
        )

        state = {
            "count": count,
            "new_in_round": 0,
            "last_screenshot_hash": last_screenshot_hash,
            "seen_strict": seen_strict,
            "seen_loose": seen_loose,
            "seen_comment_uid": seen_comment_uid,
            "metrics": stats if isinstance(stats, dict) else None,
            "qa_state": qa_state,
        }
        process_candidate = build_process_candidate(
            page=page,
            dataset=dataset,
            kv_store=kv_store,
            context=context,
            comment_container=comment_container,
            run_folder=run_folder,
            screenshot_timeout_ms=screenshot_timeout_ms,
            log_every_n_screenshots=log_every_n_screenshots,
            state=state,
            max_comment_likers=max_comment_likers,
            liker_collection_mode=liker_collection_mode,
        )

        for row_handle in row_handles:
            data, element_handle = await extract_comment_from_item(row_handle)
            await process_candidate(data, element_handle)
            if max_comments and state["count"] >= max_comments:
                break

        if (not max_comments or state["count"] < max_comments) and state["new_in_round"] == 0:
            for time_handle in time_handles:
                data, element_handle = await extract_comment_from_time(time_handle)
                await process_candidate(data, element_handle)
                if max_comments and state["count"] >= max_comments:
                    break

        count = state["count"]
        new_in_round = state["new_in_round"]
        last_screenshot_hash = state["last_screenshot_hash"]

        if max_comments and count >= max_comments:
            break

        if new_in_round == 0:
            idle += 1
            stale_rounds += 1
        else:
            idle = 0
            stale_rounds = 0

        if stale_rounds >= no_new_rounds_before_rescan and rescan_passes < max_rescan_passes:
            log_event(
                "scrape.rescan.start",
                stale_rounds=stale_rounds,
                pass_index=rescan_passes + 1,
                max_rescan_passes=max_rescan_passes,
            )
            try:
                await asyncio.wait_for(load_all_comments(page, 45, 6, safe_mode=safe_interaction_mode), timeout=150)
            except Exception as exc:
                warn_event("scrape.rescan.load_all_comments_warning", error_type=type(exc).__name__, error=repr(exc))

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
            await open_comments_panel(page, safe_mode=safe_interaction_mode)
            await dismiss_login_wall(page)
            await expand_comments(page, 40, safe_mode=safe_interaction_mode)
            stale_rounds = 0
            idle = 0
            rescan_passes += 1
            no_gain_after_rescan = True
            continue

        if no_gain_after_rescan and new_in_round == 0:
            log_event("scrape.rescan.no_gain_stop")
            break

        if new_in_round > 0:
            no_gain_after_rescan = False

        if idle >= ui_idle_rounds:
            break

        await page.evaluate(
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

        # Do not double-count idle rounds: idle is already tracked by
        # `new_in_round == 0` above.
        await page.wait_for_timeout(1200)

    if isinstance(stats, dict):
        stats["comments_captured"] = count
    return count
