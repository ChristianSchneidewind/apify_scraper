def build_multipart_flags(screenshot_keys):
    needs_review = len(screenshot_keys) > 2
    return {
        "partsTotal": len(screenshot_keys),
        "multipartNeedsReview": needs_review,
        "multipartFlagReason": "more_than_2_parts" if needs_review else None,
    }


def build_payload_common_fields(*, data, index, source_url, comment_permalink, comment_url, comment_deep_link):
    return {
        "username": data["username"],
        "text": data["text"],
        "isGifOnly": bool(data.get("isGifOnly")),
        "datetime": data.get("datetime"),
        "timeText": data.get("timeText"),
        "commentPermalink": comment_permalink,
        "commentUrl": comment_url,
        "commentDeepLink": comment_deep_link,
        "likesCount": int(data.get("likesCount") or 0),
        "commentLikers": data.get("commentLikers") or [],
        "index": index,
        "sourceUrl": source_url,
    }


def build_metadata_payload(*, screenshot_uuid, screenshot_utc, data, index, source_url, comment_permalink, comment_url, comment_deep_link, screenshot_keys):
    return {
        "id": screenshot_uuid,
        "capturedAtUtc": screenshot_utc,
        **build_payload_common_fields(
            data=data,
            index=index,
            source_url=source_url,
            comment_permalink=comment_permalink,
            comment_url=comment_url,
            comment_deep_link=comment_deep_link,
        ),
        **build_multipart_flags(screenshot_keys),
        "screenshotKeys": screenshot_keys,
    }


def build_dataset_payload(*, screenshot_uuid, screenshot_paths, screenshot_keys, metadata_path, data, index, source_url, comment_permalink, comment_url, comment_deep_link):
    return {
        "id": screenshot_uuid if screenshot_paths else None,
        **build_payload_common_fields(
            data=data,
            index=index,
            source_url=source_url,
            comment_permalink=comment_permalink,
            comment_url=comment_url,
            comment_deep_link=comment_deep_link,
        ),
        "screenshotKey": screenshot_keys[0] if screenshot_keys else None,
        "screenshotPath": screenshot_paths[0] if screenshot_paths else None,
        "screenshotKeys": screenshot_keys,
        "screenshotPaths": screenshot_paths,
        **build_multipart_flags(screenshot_keys),
        "metadataPath": metadata_path,
    }
