import asyncio

from src.click_guard import dismiss_suspicious_dialog_if_present


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
