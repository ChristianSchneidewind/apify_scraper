import asyncio

from apify import Actor

from .auth import dismiss_login_wall
from .comment_processor import build_process_candidate
from .comments import extract_comment_from_item, extract_comment_from_time, get_dialog_comment_rows, get_post_comment_rows
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

    for round_idx in range(max_ui_rounds):
        comment_container = await get_comment_container(page)
        await expand_comments(page, 30)
        try:
            await expand_all_reply_threads(page, max_clicks=100)
        except Exception:
            pass

        is_post_page = "/p/" in context.request.url
        row_handles = await (get_post_comment_rows(page) if is_post_page else get_dialog_comment_rows(page))
        time_sel = 'div[role="dialog"] time, article time, li time, time'
        time_handles = await page.query_selector_all(time_sel)
        Actor.log.info(
            f"Round {round_idx + 1}: {len(row_handles)} comment rows, "
            f"{len(time_handles)} time nodes (post_page={is_post_page})"
        )

        state = {
            "count": count,
            "new_in_round": 0,
            "last_screenshot_hash": last_screenshot_hash,
            "seen_strict": seen_strict,
            "seen_loose": seen_loose,
            "seen_comment_uid": seen_comment_uid,
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
            Actor.log.info(
                f"No new comments for {stale_rounds} rounds. Starting rescan pass {rescan_passes + 1}/{max_rescan_passes}."
            )
            try:
                await asyncio.wait_for(load_all_comments(page, 45, 6), timeout=150)
            except Exception as exc:
                Actor.log.warning(f"rescan load_all_comments warning: {type(exc).__name__}: {exc!r}")

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
            no_gain_after_rescan = True
            continue

        if no_gain_after_rescan and new_in_round == 0:
            Actor.log.info("No gain after rescan; stopping early.")
            break

        if new_in_round > 0:
            no_gain_after_rescan = False

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

    return count
