import asyncio
import json
from pathlib import Path

import src.screenshots as ss


class FakeKV:
    def __init__(self):
        self.calls = []

    async def set_value(self, key, value, content_type=None):
        self.calls.append((key, content_type))


class FakePage:
    url = "https://example.com/p/x/"

    async def screenshot(self, full_page=False, timeout=None):
        return b"img"

    async def content(self):
        return "<html></html>"

    async def evaluate(self, _script):
        return [{"i": 1}]


def test_save_screenshot_and_collision(tmp_path, monkeypatch):
    monkeypatch.setattr(ss, "SCREENSHOTS_DIR", tmp_path)

    p1 = asyncio.run(ss.save_screenshot(b"a", "x.png"))
    p2 = asyncio.run(ss.save_screenshot(b"b", "x.png"))

    assert Path(p1).name == "x.png"
    assert Path(p2).name == "x-1.png"


def test_save_comment_metadata(tmp_path, monkeypatch):
    monkeypatch.setattr(ss, "SCREENSHOTS_DIR", tmp_path)
    out = ss.save_comment_metadata({"id": 1}, "shot.png")
    data = json.loads(Path(out).read_text(encoding="utf-8"))
    assert data["id"] == 1
    assert Path(out).name == "shot.json"


def test_init_screenshot_session_shape():
    session = ss.init_screenshot_session()
    assert session.screenshot_uuid
    assert session.screenshot_keys == []
    assert session.screenshot_paths == []
    assert session.metadata_path is None


def test_run_3plus_capture_fallback_updates_state(monkeypatch):
    async def fake_capture(**_kwargs):
        return (["k1"], ["p1"], "hash1")

    monkeypatch.setattr(ss, "capture_comment_multipart_3plus", fake_capture)

    state = {"last_screenshot_hash": None}
    keys, paths = [], []

    asyncio.run(
        ss.run_3plus_capture_fallback(
            page=FakePage(),
            element_handle=object(),
            comment_container=None,
            data={"username": "u"},
            screenshot_uuid="u1",
            screenshot_utc="2026",
            parts_target=3,
            base_sig="sig",
            screenshot_timeout_ms=1000,
            kv_store=FakeKV(),
            run_folder="run",
            state=state,
            screenshot_keys=keys,
            screenshot_paths=paths,
            comment_index=1,
        )
    )

    assert keys == ["k1"]
    assert paths == ["p1"]
    assert state["last_screenshot_hash"] == "hash1"
