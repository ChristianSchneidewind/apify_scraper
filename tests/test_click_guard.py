import asyncio

from pathlib import Path

import src.click_guard as cg
from src.click_guard import build_safe_click_js_helpers, dismiss_suspicious_dialog_if_present


class FakeKeyboard:
    def __init__(self):
        self.pressed = []

    async def press(self, key):
        self.pressed.append(key)


class FakePage:
    def __init__(self, evaluate_result):
        self.evaluate_result = evaluate_result
        self.keyboard = FakeKeyboard()
        self.waits = []
        self.screenshots = []

    async def evaluate(self, _script, _arg=None):
        return self.evaluate_result

    async def wait_for_timeout(self, ms):
        self.waits.append(ms)

    async def screenshot(self, path=None, full_page=False):
        self.screenshots.append((path, full_page))
        if path:
            Path(path).write_bytes(b"png")
        return b"png"

    async def content(self):
        return "<html>debug</html>"


def test_dismiss_suspicious_dialog_if_present_dismisses_detected_dialog(tmp_path, monkeypatch):
    monkeypatch.setattr(cg, "SCREENSHOTS_DIR", tmp_path)
    page = FakePage({"open": True, "suspicious": True, "text": "report this post"})
    out = asyncio.run(dismiss_suspicious_dialog_if_present(page, source="test"))
    assert out is True
    assert page.keyboard.pressed == ["Escape"]
    assert page.waits == [150]
    debug_dir = tmp_path / "_ui_debug"
    assert debug_dir.exists()
    assert list(debug_dir.glob("*.png"))
    assert list(debug_dir.glob("*.html"))


def test_dismiss_suspicious_dialog_if_present_ignores_normal_result():
    page = FakePage({"open": True, "suspicious": False, "text": "comments"})
    out = asyncio.run(dismiss_suspicious_dialog_if_present(page, source="test"))
    assert out is False
    assert page.keyboard.pressed == []


def test_build_safe_click_js_helpers_includes_expected_helpers_by_flag():
    base = build_safe_click_js_helpers()
    with_comment = build_safe_click_js_helpers(include_comment_context=True)
    with_like = build_safe_click_js_helpers(include_like_text=True)

    assert "const norm =" in base
    assert "const isOptionsTrigger =" in base
    assert "const hasCommentContext =" not in base
    assert "const isLikeText =" not in base
    assert "const hasCommentContext =" in with_comment
    assert "const isLikeText =" in with_like
