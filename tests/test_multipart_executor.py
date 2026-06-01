import asyncio
from types import SimpleNamespace

import src.multipart_executor as me


class FakePage:
    def __init__(self, eval_results=None, shot=b"img", url="https://x"):
        self.eval_results = list(eval_results or [])
        self.shot = shot
        self.url = url

    async def evaluate(self, _script, _arg=None):
        if self.eval_results:
            return self.eval_results.pop(0)
        return {"ok": True, "rowTop": 1, "rowBottom": 10}

    async def screenshot(self, full_page=False, timeout=None):
        return self.shot


class FakeKV:
    def __init__(self):
        self.saved = []

    async def set_value(self, key, value, content_type=None):
        self.saved.append((key, content_type))


def test_build_verify_payload():
    out = me.build_verify_payload(
        data={"username": "u"},
        element_handle="el",
        comment_container="cc",
        mode="single",
        part_top=0,
        part_idx=1,
        total_parts=1,
        base_sig="sig",
    )
    assert out["el"] == "el"
    assert out["username"] == "u"


def test_capture_comment_assets_happy_path(monkeypatch):
    page = FakePage(eval_results=[{"ok": True, "rowTop": 1, "rowBottom": 20}])
    kv = FakeKV()
    state = {"count": 1, "last_screenshot_hash": None}

    async def plan_comment_multipart(**_k):
        return {
            "scroll_parts": [0],
            "mode": "single",
            "base_sig": "s",
            "total_parts": 1,
            "use_3plus_route": False,
            "planned_parts_3plus": 1,
        }

    monkeypatch.setattr(me, "plan_comment_multipart", plan_comment_multipart)
    monkeypatch.setattr(me, "safe_wait", lambda *_a, **_k: asyncio.sleep(0))
    monkeypatch.setattr(me, "fit_element_in_viewport", lambda *_a, **_k: asyncio.sleep(0))
    monkeypatch.setattr(me, "highlight", lambda *_a, **_k: asyncio.sleep(0, result={"ok": True}))
    monkeypatch.setattr(me, "set_screenshot_banner", lambda *_a, **_k: asyncio.sleep(0))
    monkeypatch.setattr(me, "save_screenshot", lambda *_a, **_k: asyncio.sleep(0, result="Screenshots/a.png"))
    monkeypatch.setattr(me, "should_run_geometry_fallback", lambda *_a, **_k: False)
    monkeypatch.setattr(me, "build_metadata_payload", lambda **_k: {"id": "u1"})
    monkeypatch.setattr(me, "save_comment_metadata", lambda *_a, **_k: "m.json")

    out = asyncio.run(
        me.capture_comment_assets(
            page=page,
            kv_store=kv,
            context=SimpleNamespace(request=SimpleNamespace(url="https://src")),
            comment_container=None,
            element_handle=object(),
            data={"username": "u", "text": "t"},
            state=state,
            run_folder="run",
            screenshot_timeout_ms=1000,
            screenshot_uuid="u1",
            screenshot_utc="2026-01-01T00:00:00Z",
            screenshot_keys=[],
            screenshot_paths=[],
            metadata_path=None,
            comment_permalink=None,
            comment_url=None,
            comment_deep_link=None,
        )
    )

    assert out == "m.json"
    assert kv.saved and kv.saved[0][0] == "u1.png"


def test_capture_comment_assets_3plus_route_calls_fallback(monkeypatch):
    page = FakePage()
    kv = FakeKV()
    called = {"fb": 0}

    async def plan_comment_multipart(**_k):
        return {
            "scroll_parts": [0, 1, 2],
            "mode": "row",
            "base_sig": "s",
            "total_parts": 3,
            "use_3plus_route": True,
            "planned_parts_3plus": 3,
        }

    async def fb(**_k):
        called["fb"] += 1

    monkeypatch.setattr(me, "plan_comment_multipart", plan_comment_multipart)
    monkeypatch.setattr(me, "run_3plus_fallback_with_context", fb)
    monkeypatch.setattr(me, "should_run_geometry_fallback", lambda *_a, **_k: False)

    out = asyncio.run(
        me.capture_comment_assets(
            page=page,
            kv_store=kv,
            context=SimpleNamespace(request=SimpleNamespace(url="https://src")),
            comment_container=None,
            element_handle=object(),
            data={"username": "u", "text": "t"},
            state={"count": 1, "last_screenshot_hash": None},
            run_folder="run",
            screenshot_timeout_ms=1000,
            screenshot_uuid="u1",
            screenshot_utc="2026",
            screenshot_keys=[],
            screenshot_paths=[],
            metadata_path=None,
            comment_permalink=None,
            comment_url=None,
            comment_deep_link=None,
        )
    )

    assert called["fb"] == 1
    assert out is None
