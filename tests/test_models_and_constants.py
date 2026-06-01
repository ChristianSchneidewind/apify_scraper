from src.comment_models import ScreenshotSession
from src.constants import LOAD_MORE_TEXTS, VIEWPORT_HEIGHT, VIEWPORT_WIDTH
from src.instagram_dom import COMMENT_PERMALINK_SELECTOR, COMMENT_TIME_SELECTOR


def test_screenshot_session_defaults():
    s = ScreenshotSession("u1")
    assert s.screenshot_uuid == "u1"
    assert s.screenshot_keys == []
    assert s.screenshot_paths == []
    assert s.metadata_path is None


def test_constants_and_selectors_sanity():
    assert VIEWPORT_WIDTH > 0 and VIEWPORT_HEIGHT > 0
    assert any("View more comments" in t for t in LOAD_MORE_TEXTS)
    assert "time" in COMMENT_TIME_SELECTOR
    assert "/c/" in COMMENT_PERMALINK_SELECTOR
