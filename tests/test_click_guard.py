import asyncio

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

    async def evaluate(self, _script, _arg=None):
        return self.evaluate_result

    async def wait_for_timeout(self, ms):
        self.waits.append(ms)


def test_dismiss_suspicious_dialog_if_present_dismisses_detected_dialog():
    page = FakePage({"open": True, "suspicious": True, "text": "report this post"})
    out = asyncio.run(dismiss_suspicious_dialog_if_present(page, source="test"))
    assert out is True
    assert page.keyboard.pressed == ["Escape"]
    assert page.waits == [150]


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
