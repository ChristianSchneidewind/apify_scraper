from .comment_likers import enrich_comment_likers
from .comment_text import normalize_comment_likers
from .log_events import warn_event
from .payloads import build_dataset_payload

# Multipart tuning knobs (keep centralized to avoid accidental regressions).
LONG_TEXT_THRESHOLD = 430
FORCED_MULTIPART_BASE = 430


async def enrich_and_normalize_likers(*, page, element_handle, data, max_comment_likers, liker_collection_mode="best_effort"):
    data = await enrich_comment_likers(
        page,
        element_handle,
        data,
        max_comment_likers=max_comment_likers,
        liker_collection_mode=liker_collection_mode,
    )
    data["commentLikers"] = normalize_comment_likers(data.get("commentLikers"))
    return data


def _qa_check_payload(payload: dict):
    missing = []
    for key in ("username", "text", "sourceUrl"):
        if not payload.get(key):
            missing.append(key)

    if missing:
        warn_event("dataset.qa.missing_fields", missing=missing, index=payload.get("index"), id=payload.get("id"))

    screenshot_paths = payload.get("screenshotPaths") or []
    if len(screenshot_paths) != len(set(screenshot_paths)):
        warn_event("dataset.qa.duplicate_screenshot_paths", index=payload.get("index"), count=len(screenshot_paths))


def _qa_track_state(state: dict, payload: dict):
    if not isinstance(state, dict):
        return
    state["items_total"] = int(state.get("items_total", 0)) + 1
    if not payload.get("username") or not payload.get("text") or not payload.get("sourceUrl"):
        state["items_with_missing_fields"] = int(state.get("items_with_missing_fields", 0)) + 1


async def persist_comment_result(*, dataset, screenshot_uuid, screenshot_paths, screenshot_keys, metadata_path, data, index, source_url, comment_permalink, comment_url, comment_deep_link, qa_state=None):
    payload = build_dataset_payload(
        screenshot_uuid=screenshot_uuid,
        screenshot_paths=screenshot_paths,
        screenshot_keys=screenshot_keys,
        metadata_path=metadata_path,
        data=data,
        index=index,
        source_url=source_url,
        comment_permalink=comment_permalink,
        comment_url=comment_url,
        comment_deep_link=comment_deep_link,
    )
    _qa_check_payload(payload)
    _qa_track_state(qa_state, payload)
    await dataset.push_data(payload)
