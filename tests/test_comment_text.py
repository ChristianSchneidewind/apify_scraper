from src.comment_text import (
    build_comment_context,
    build_comment_links,
    log_gif_comment_if_needed,
    normalize_comment_likers,
    should_log_screenshot,
)


def test_normalize_comment_likers_builds_profile_urls_and_filters_invalid():
    out = normalize_comment_likers(
        [
            {"username": "alice", "profilePath": "/alice/"},
            {"username": "bob", "profileUrl": "https://www.instagram.com/bob/"},
            {"username": "", "profilePath": "/x/"},
            "bad",
        ]
    )

    assert out == [
        {"username": "alice", "profileUrl": "https://www.instagram.com/alice/"},
        {"username": "bob", "profileUrl": "https://www.instagram.com/bob/"},
    ]


def test_build_comment_links_creates_comment_url_and_deep_link():
    comment_url, deep_link = build_comment_links(
        "/p/XYZ/c/1234567890/",
        "https://www.instagram.com/reels/XYZ/?utm_source=x",
    )

    assert comment_url == "https://www.instagram.com/p/XYZ/c/1234567890/"
    assert deep_link == "https://www.instagram.com/reel/XYZ/?comment_id=1234567890"


def test_should_log_screenshot_policy():
    assert should_log_screenshot(1, 25)
    assert should_log_screenshot(5, 25)
    assert not should_log_screenshot(6, 25)
    assert should_log_screenshot(25, 25)


def test_build_comment_links_without_comment_id_has_no_deep_link():
    comment_url, deep_link = build_comment_links(
        "/p/XYZ/not-a-comment-path/",
        "https://www.instagram.com/p/XYZ/",
    )

    assert comment_url == "https://www.instagram.com/p/XYZ/not-a-comment-path/"
    assert deep_link is None


def test_build_comment_links_with_absolute_permalink_keeps_url_and_builds_deep_link():
    comment_url, deep_link = build_comment_links(
        "https://www.instagram.com/p/XYZ/c/987654321/",
        "https://www.instagram.com/p/XYZ/?utm_source=test",
    )

    assert comment_url == "https://www.instagram.com/p/XYZ/c/987654321/"
    assert deep_link == "https://www.instagram.com/p/XYZ/?comment_id=987654321"


def test_build_comment_links_handles_missing_source_url():
    comment_url, deep_link = build_comment_links("/p/XYZ/c/123/", None)

    assert comment_url == "https://www.instagram.com/p/XYZ/c/123/"
    assert deep_link == "?comment_id=123"


def test_normalize_comment_likers_ignores_whitespace_only_or_missing_data():
    out = normalize_comment_likers(
        [
            {"username": "   ", "profilePath": "/alice/"},
            {"username": "eve", "profilePath": "   "},
            {"username": "frank", "profileUrl": "   "},
            {"profilePath": "/nobody/"},
        ]
    )

    assert out == []


def test_build_comment_context_returns_permalink_and_links():
    permalink, url, deep = build_comment_context(
        {"commentPermalink": "/p/XYZ/c/123/"},
        "https://www.instagram.com/p/XYZ/",
    )
    assert permalink == "/p/XYZ/c/123/"
    assert url == "https://www.instagram.com/p/XYZ/c/123/"
    assert deep == "https://www.instagram.com/p/XYZ/?comment_id=123"


def test_log_gif_comment_if_needed(monkeypatch):
    events = []

    def fake_log_event(event, **fields):
        events.append((event, fields))

    monkeypatch.setattr("src.comment_text.log_event", fake_log_event)

    log_gif_comment_if_needed({"isGifOnly": False, "username": "u"}, 1)
    log_gif_comment_if_needed({"isGifOnly": True, "username": "u"}, 2)

    assert events == [("comment.gif_only", {"username": "u", "index": 2})]
