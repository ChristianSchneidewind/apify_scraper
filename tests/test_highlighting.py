from src.highlighting import HIGHLIGHT_COMMENT_JS, build_highlight_payload


def test_build_highlight_payload_maps_expected_fields():
    payload = build_highlight_payload(
        element_handle="element-ref",
        comment_data={
            "username": "alice",
            "text": "hello world",
            "isGifOnly": 1,
            "commentPermalink": "/p/abc/c/123/",
            "userProfilePath": "/alice/",
        },
    )

    assert payload == {
        "el": "element-ref",
        "username": "alice",
        "text": "hello world",
        "isGifOnly": True,
        "commentPermalink": "/p/abc/c/123/",
        "userProfilePath": "/alice/",
    }


def test_highlight_script_contains_expected_sections():
    assert "detached_no_fallback" in HIGHLIGHT_COMMENT_JS
    assert "isTightPostRow" in HIGHLIGHT_COMMENT_JS
    assert "row_does_not_match_text" in HIGHLIGHT_COMMENT_JS
    assert "data-apify-highlight" in HIGHLIGHT_COMMENT_JS
    assert "expandedForAvatar" in HIGHLIGHT_COMMENT_JS
