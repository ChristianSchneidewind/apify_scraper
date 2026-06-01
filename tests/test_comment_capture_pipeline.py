import asyncio
from types import SimpleNamespace

import src.comment_capture_pipeline as cp
import src.comment_processor as cproc


async def _noop(*_args, **_kwargs):
    return None


def _ctx(url="https://www.instagram.com/p/abc/"):
    return SimpleNamespace(request=SimpleNamespace(url=url))


def test_comment_processor_wrapper_points_to_pipeline_builder():
    assert cproc.build_process_candidate is cp.build_process_candidate


def test_process_candidate_returns_false_for_empty_inputs(monkeypatch):
    state = {"count": 0}
    proc = cp.build_process_candidate(
        page=object(),
        dataset=None,
        kv_store=None,
        context=_ctx(),
        comment_container=None,
        run_folder="run",
        screenshot_timeout_ms=1000,
        log_every_n_screenshots=10,
        state=state,
        max_comment_likers=0,
    )

    assert asyncio.run(proc(None, object())) is False
    assert asyncio.run(proc({"x": 1}, None)) is False


def test_process_candidate_happy_path(monkeypatch):
    state = {"count": 0, "new_in_round": 0, "last_screenshot_hash": None}
    calls = {"persist": 0, "capture": 0}

    async def register(*_args, **_kwargs):
        return True, "s", "l", "u"

    def inc(st):
        st["count"] += 1
        st["new_in_round"] += 1

    async def ensure(*_args, **_kwargs):
        return {"ok": True}

    async def enrich(**kwargs):
        d = dict(kwargs["data"])
        d["commentLikers"] = []
        return d

    def init_session():
        return SimpleNamespace(
            screenshot_uuid="uid",
            screenshot_paths=[],
            screenshot_keys=[],
            metadata_path=None,
            screenshot_utc="2026-01-01T00:00:00Z",
        )

    async def capture(**_kwargs):
        calls["capture"] += 1
        return "m.json"

    async def persist(**_kwargs):
        calls["persist"] += 1

    monkeypatch.setattr(cp, "register_candidate_or_skip", register)
    monkeypatch.setattr(cp, "increment_comment_counters", inc)
    monkeypatch.setattr(cp, "log_gif_comment_if_needed", lambda *_a, **_k: None)
    monkeypatch.setattr(cp, "prepare_comment_for_capture", _noop)
    monkeypatch.setattr(cp, "ensure_highlight_ready", ensure)
    monkeypatch.setattr(cp, "handle_highlight_failure", _noop)
    monkeypatch.setattr(cp, "prepare_visual_for_screenshot", _noop)
    monkeypatch.setattr(cp, "enrich_and_normalize_likers", enrich)
    monkeypatch.setattr(cp, "init_screenshot_session", init_session)
    monkeypatch.setattr(cp, "should_log_screenshot", lambda *_a, **_k: False)
    monkeypatch.setattr(cp, "build_comment_context", lambda data, src: (data.get("commentPermalink"), "https://c", "https://d"))
    monkeypatch.setattr(cp, "capture_comment_assets", capture)
    monkeypatch.setattr(cp, "persist_comment_result", persist)

    proc = cp.build_process_candidate(
        page=object(),
        dataset=object(),
        kv_store=object(),
        context=_ctx(),
        comment_container=object(),
        run_folder="run",
        screenshot_timeout_ms=1000,
        log_every_n_screenshots=10,
        state=state,
        max_comment_likers=10,
    )

    ok = asyncio.run(proc({"username": "alice", "text": "hi", "commentPermalink": "/p/x/c/1/"}, object()))
    assert ok is True
    assert state["count"] == 1
    assert calls["capture"] == 1
    assert calls["persist"] == 1
