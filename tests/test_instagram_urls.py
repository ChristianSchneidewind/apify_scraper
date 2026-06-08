from src.instagram_urls import (
    classify_instagram_url,
    extract_profile_username,
    is_post_or_reel_url,
    is_profile_url,
    normalize_instagram_url,
)


def test_normalize_instagram_url_normalizes_reels_path():
    assert normalize_instagram_url("https://www.instagram.com/reels/abc/") == "https://www.instagram.com/reel/abc/"


def test_post_and_reel_urls_are_detected():
    assert is_post_or_reel_url("https://www.instagram.com/p/abc/") is True
    assert is_post_or_reel_url("https://www.instagram.com/reels/abc/") is True
    assert classify_instagram_url("https://www.instagram.com/reel/abc/") == "post"


def test_profile_url_detection_and_username_extraction():
    url = "https://www.instagram.com/nasa/?hl=en"
    assert is_profile_url(url) is True
    assert classify_instagram_url(url) == "profile"
    assert extract_profile_username(url) == "nasa"


def test_reserved_non_profile_paths_are_rejected():
    assert is_profile_url("https://www.instagram.com/explore/") is False
    assert classify_instagram_url("https://www.instagram.com/accounts/login/") == "unknown"
