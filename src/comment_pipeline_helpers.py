from .comment_likers import enrich_comment_likers
from .comment_text import normalize_comment_likers
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


async def persist_comment_result(*, dataset, screenshot_uuid, screenshot_paths, screenshot_keys, metadata_path, data, index, source_url, comment_permalink, comment_url, comment_deep_link):
    await dataset.push_data(
        build_dataset_payload(
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
    )
