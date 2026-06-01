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
