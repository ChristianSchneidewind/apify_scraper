import asyncio

import src.ui as ui


class FakePage:
    def __init__(self):
        self.eval_calls = 0

    async def evaluate(self, _script, _arg=None):
        self.eval_calls += 1
        return None


class FakeElement:
    def __init__(self, should_fail=False):
        self.should_fail = should_fail

    async def scroll_into_view_if_needed(self, timeout=0):
        if self.should_fail:
            raise RuntimeError("nope")


def test_visual_helpers_call_evaluate():
    page = FakePage()
    asyncio.run(ui.hide_visual_overlays(page))
    asyncio.run(ui.freeze_animated_media(page))
    asyncio.run(ui.set_screenshot_banner(page, "https://x", "2026-01-01"))
    assert page.eval_calls == 3


def test_scroll_and_fit_guard_on_missing_element():
    page = FakePage()
    asyncio.run(ui.scroll_to_element(page, None))
    asyncio.run(ui.fit_element_in_viewport(page, None))
    assert page.eval_calls == 0


def test_scroll_to_element_handles_scroll_into_view_error():
    page = FakePage()
    el = FakeElement(should_fail=True)
    asyncio.run(ui.scroll_to_element(page, el, None))
    assert page.eval_calls == 1


def test_expand_comment_row_text_returns_after_suspicious_dialog(monkeypatch):
    page = FakePage()

    async def fake_dismiss(_page, *, source):
        return True

    async def fake_evaluate(_script, _arg=None):
        page.eval_calls += 1
        return 1

    page.evaluate = fake_evaluate
    monkeypatch.setattr(ui, "dismiss_suspicious_dialog_if_present", fake_dismiss)

    out = asyncio.run(ui.expand_comment_row_text(page, object(), max_clicks=3))

    assert out == 1
    assert page.eval_calls == 1
