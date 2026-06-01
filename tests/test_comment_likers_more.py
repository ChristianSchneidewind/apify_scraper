import asyncio

import src.comment_likers as cl


class _BrokenLocator:
    async def count(self):
        raise RuntimeError("boom")


class _PageDialogFail:
    def locator(self, _sel):
        return _BrokenLocator()


class _Locator:
    def __init__(self, count=0):
        self._count = count
        self.first = self

    async def count(self):
        return self._count


class _PageNoAnchor:
    def __init__(self, count=0):
        self._loc = _Locator(count=count)

    def locator(self, _sel):
        return self._loc


def test_dialog_is_open_handles_exception():
    out = asyncio.run(cl._dialog_is_open(_PageDialogFail()))
    assert out is False


def test_click_likes_on_deep_page_guard_clauses():
    out1 = asyncio.run(cl._click_likes_on_deep_page(_PageNoAnchor(), None))
    assert out1["clicked"] is False
    assert out1["reason"] == "deep_missing_permalink"

    out2 = asyncio.run(cl._click_likes_on_deep_page(_PageNoAnchor(count=0), "/p/x/c/1/"))
    assert out2["clicked"] is False
    assert out2["reason"] == "deep_target_comment_not_found"
