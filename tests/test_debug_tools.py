import asyncio
import json

import src.debug_tools as dt


class FakePage:
    def __init__(self):
        self.handlers = {}

    def on(self, event, cb):
        self.handlers[event] = cb

    async def screenshot(self, full_page=True, timeout=None):
        return b"img"

    async def content(self):
        return "<html></html>"

    async def eval_on_selector_all(self, _selector, expr):
        if "slice(0, 5)" in expr:
            return ["<time>1</time>"]
        return [{"time": "<time>1</time>", "ancestors": ["<div>"]}]


class FakeKV:
    def __init__(self):
        self.saved = []

    async def set_value(self, key, value, content_type=None):
        self.saved.append((key, value, content_type))


class Req:
    def __init__(self, url, method="GET", post_data=""):
        self.url = url
        self.method = method
        self.post_data = post_data


class Resp:
    def __init__(self, req, url=None, status=200, body="ok"):
        self.request = req
        self.url = url or req.url
        self.status = status
        self._body = body

    async def text(self):
        return self._body


def test_dump_no_comments_debug_saves_artifacts():
    page = FakePage()
    kv = FakeKV()
    asyncio.run(dt.dump_no_comments_debug(page, kv, 1000))
    keys = [k for k, *_ in kv.saved]
    assert any(k.endswith(".png") for k in keys)
    assert any(k.endswith("-page.html") for k in keys)
    assert any(k.endswith("-samples.json") for k in keys)


def test_enable_comment_network_debug_registers_and_saves(monkeypatch):
    async def _run():
        page = FakePage()
        kv = FakeKV()
        created_tasks = []

        real_create_task = asyncio.create_task

        def _create_task(coro):
            t = real_create_task(coro)
            created_tasks.append(t)
            return t

        monkeypatch.setattr(asyncio, "create_task", _create_task)

        dt.enable_comment_network_debug(page, kv)

        assert "request" in page.handlers and "response" in page.handlers

        page.handlers["request"](Req("https://x/graphql", post_data="comment PolarisPostCommentsContainerQuery"))
        page.handlers["response"](Resp(Req("https://instagram.com/api", post_data="comment"), body="{\"ok\":1}"))

        if created_tasks:
            await asyncio.gather(*created_tasks)

        keys = [k for k, *_ in kv.saved]
        assert any("debug-comments-req" in k for k in keys)
        assert any("debug-comments-resp" in k for k in keys)

        req_payload = [v for k, v, _ in kv.saved if "req" in k][0]
        json.loads(req_payload)

    asyncio.run(_run())
