import asyncio

import src.screenshots as ss


class FakeKV:
    def __init__(self):
        self.calls = []

    async def set_value(self, key, value, content_type=None):
        self.calls.append((key, content_type))


class GoodPage:
    url = "https://example.com"

    async def screenshot(self, full_page=False, timeout=None):
        return b"img"

    async def content(self):
        return "<html></html>"

    async def evaluate(self, _script):
        return [{"x": 1}]


class BadPage(GoodPage):
    async def screenshot(self, full_page=False, timeout=None):
        raise RuntimeError("shot")

    async def content(self):
        raise RuntimeError("html")

    async def evaluate(self, _script):
        raise RuntimeError("dom")


def test_dump_skip_debug_writes_all_when_available():
    kv = FakeKV()
    asyncio.run(ss.dump_skip_debug(GoodPage(), kv, 1, {"u": 1}, 1000))
    keys = [k for k, _ in kv.calls]
    assert "debug-skip-1.png" in keys
    assert "debug-skip-1.html" in keys
    assert "debug-skip-1.json" in keys


def test_dump_skip_debug_swallows_internal_errors():
    kv = FakeKV()
    asyncio.run(ss.dump_skip_debug(BadPage(), kv, 2, {"u": 1}, 1000))
    assert kv.calls == []
