from src.payloads import (
    build_dataset_payload,
    build_metadata_payload,
    build_multipart_flags,
    build_payload_common_fields,
    build_profile_dataset_payload,
    build_profile_metadata_payload,
)


def _data(**overrides):
    base = {
        "username": "alice",
        "text": "hello",
        "isGifOnly": False,
        "datetime": "2026-01-01T00:00:00Z",
        "timeText": "1d",
        "likesCount": "3",
        "commentLikers": [{"username": "bob"}],
    }
    base.update(overrides)
    return base


def test_build_multipart_flags():
    assert build_multipart_flags(["a"]) == {
        "partsTotal": 1,
        "multipartNeedsReview": False,
        "multipartFlagReason": None,
    }
    assert build_multipart_flags(["a", "b", "c"])["multipartNeedsReview"] is True


def test_build_payload_common_fields_casts_defaults():
    out = build_payload_common_fields(
        data=_data(likesCount=None, commentLikers=None),
        index=7,
        source_url="https://src",
        comment_permalink="/p/x/c/1/",
        comment_url="https://www.instagram.com/p/x/c/1/",
        comment_deep_link="https://www.instagram.com/p/x/?comment_id=1",
    )
    assert out["itemType"] == "comment"
    assert out["likesCount"] == 0
    assert out["commentLikers"] == []
    assert out["index"] == 7


def test_build_metadata_and_dataset_payloads():
    common = dict(
        data=_data(),
        index=1,
        source_url="https://src",
        comment_permalink="/p/x/c/1/",
        comment_url="https://www.instagram.com/p/x/c/1/",
        comment_deep_link="https://www.instagram.com/p/x/?comment_id=1",
    )

    meta = build_metadata_payload(
        screenshot_uuid="u1",
        screenshot_utc="2026-01-01T00:00:00Z",
        screenshot_keys=["k1", "k2", "k3"],
        **common,
    )
    assert meta["id"] == "u1"
    assert meta["partsTotal"] == 3
    assert meta["multipartNeedsReview"] is True

    ds = build_dataset_payload(
        screenshot_uuid="u1",
        screenshot_paths=["/tmp/1.png"],
        screenshot_keys=["k1"],
        metadata_path="/tmp/m.json",
        **common,
    )
    assert ds["id"] == "u1"
    assert ds["screenshotKey"] == "k1"
    assert ds["screenshotPath"] == "/tmp/1.png"

    ds_empty = build_dataset_payload(
        screenshot_uuid="u1",
        screenshot_paths=[],
        screenshot_keys=[],
        metadata_path=None,
        **common,
    )
    assert ds_empty["id"] is None
    assert ds_empty["screenshotKey"] is None


def test_build_profile_dataset_and_metadata_payloads():
    profile_data = {
        "username": "instagram",
        "fullName": "Instagram",
        "biography": "Photos and videos",
        "stats": ["10 posts", "20 followers"],
        "avatarUrl": "https://img",
    }

    dataset_payload = build_profile_dataset_payload(
        screenshot_uuid="u2",
        source_url="https://www.instagram.com/instagram/",
        screenshot_keys=["k2"],
        screenshot_paths=["/tmp/profile.png"],
        metadata_path="/tmp/profile.json",
        profile_data=profile_data,
    )
    assert dataset_payload["itemType"] == "profile"
    assert dataset_payload["profileUrl"] == "https://www.instagram.com/instagram/"
    assert dataset_payload["profileUsername"] == "instagram"
    assert dataset_payload["text"] == "Photos and videos"

    metadata_payload = build_profile_metadata_payload(
        screenshot_uuid="u2",
        screenshot_utc="2026-01-01T00:00:00Z",
        source_url="https://www.instagram.com/instagram/",
        screenshot_keys=["k2"],
        screenshot_paths=["/tmp/profile.png"],
        profile_data=profile_data,
    )
    assert metadata_payload["itemType"] == "profile"
    assert metadata_payload["profileStats"] == ["10 posts", "20 followers"]
