import time

from .comment_pipeline_helpers import enrich_and_normalize_likers, persist_comment_result
from .comment_state import increment_comment_counters, register_candidate_or_skip
from .comment_text import build_comment_context, log_gif_comment_if_needed, should_log_screenshot
from .comment_visual_helpers import (
    ensure_highlight_ready,
    handle_highlight_failure,
    prepare_comment_for_capture,
    prepare_visual_for_screenshot,
)
from .log_events import log_event
from .multipart_executor import capture_comment_assets
from .screenshots import init_screenshot_session


def build_process_candidate(*, page, dataset, kv_store, context, comment_container, run_folder, screenshot_timeout_ms, log_every_n_screenshots, state, max_comment_likers):
    async def process_candidate(data, element_handle):
        started_at = time.perf_counter()
        if not data or not element_handle:
            return False

        should_process, strict_key, loose_key, comment_uid = await register_candidate_or_skip(
            page, state, data, element_handle
        )
        if not should_process:
            return False

        increment_comment_counters(state)
        log_gif_comment_if_needed(data, state["count"])
        await prepare_comment_for_capture(page, element_handle, comment_container)

        highlight_result = await ensure_highlight_ready(
            page=page,
            element_handle=element_handle,
            data=data,
            comment_container=comment_container,
        )
        if not highlight_result.get("ok"):
            await handle_highlight_failure(
                page=page,
                kv_store=kv_store,
                state=state,
                data=data,
                highlight_result=highlight_result,
                strict_key=strict_key,
                loose_key=loose_key,
                comment_uid=comment_uid,
                screenshot_timeout_ms=screenshot_timeout_ms,
            )
            return False

        await prepare_visual_for_screenshot(page, element_handle)

        data = await enrich_and_normalize_likers(
            page=page,
            element_handle=element_handle,
            data=data,
            max_comment_likers=max_comment_likers,
        )

        metrics = state.get("metrics") if isinstance(state, dict) else None
        if isinstance(metrics, dict):
            metrics["comments_processed"] = int(metrics.get("comments_processed", 0)) + 1
            metrics["likers_collected_total"] = int(metrics.get("likers_collected_total", 0)) + len(data.get("commentLikers") or [])

        screenshot_ctx = init_screenshot_session()
        screenshot_uuid = screenshot_ctx.screenshot_uuid
        screenshot_paths = screenshot_ctx.screenshot_paths
        screenshot_keys = screenshot_ctx.screenshot_keys
        metadata_path = screenshot_ctx.metadata_path
        screenshot_utc = screenshot_ctx.screenshot_utc

        if should_log_screenshot(state["count"], log_every_n_screenshots):
            log_event("screenshot.start", index=state["count"], source_url=context.request.url)

        comment_permalink, comment_url, comment_deep_link = build_comment_context(data, context.request.url)

        metadata_path = await capture_comment_assets(
            page=page,
            kv_store=kv_store,
            context=context,
            comment_container=comment_container,
            element_handle=element_handle,
            data=data,
            state=state,
            run_folder=run_folder,
            screenshot_timeout_ms=screenshot_timeout_ms,
            screenshot_uuid=screenshot_uuid,
            screenshot_utc=screenshot_utc,
            screenshot_keys=screenshot_keys,
            screenshot_paths=screenshot_paths,
            metadata_path=metadata_path,
            comment_permalink=comment_permalink,
            comment_url=comment_url,
            comment_deep_link=comment_deep_link,
        )

        await persist_comment_result(
            dataset=dataset,
            screenshot_uuid=screenshot_uuid,
            screenshot_paths=screenshot_paths,
            screenshot_keys=screenshot_keys,
            metadata_path=metadata_path,
            data=data,
            index=state["count"],
            source_url=context.request.url,
            comment_permalink=comment_permalink,
            comment_url=comment_url,
            comment_deep_link=comment_deep_link,
        )
        elapsed_ms = int((time.perf_counter() - started_at) * 1000)
        log_event(
            "comment.processed",
            index=state["count"],
            username=data.get("username"),
            likes_count=data.get("likesCount", 0),
            likers_collected=len(data.get("commentLikers") or []),
            screenshot_parts=len(screenshot_keys),
            elapsed_ms=elapsed_ms,
        )
        return True

    return process_candidate
