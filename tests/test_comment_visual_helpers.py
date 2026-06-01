import asyncio

import src.comment_visual_helpers as cvh


class FakePage:
    def __init__(self, eval_results=None):
        self.eval_results = list(eval_results or [])

    async def evaluate(self, _script, _arg=None):
        if self.eval_results:
            return self.eval_results.pop(0)
        return {}


async def _noop(*_a, **_k):
    return None


def test_geometry_helpers_boundaries():
    assert cvh.should_run_geometry_fallback([], False)
    assert not cvh.should_run_geometry_fallback(["k1", "k2"], False)
    assert cvh.parts_target_from_ratio(2.3) == 4
    assert cvh.parts_target_from_ratio(1.6) == 3
    assert cvh.parts_target_from_ratio(1.2) == 2


def test_prepare_comment_for_capture_calls_flow(monkeypatch):
    calls = {"expand": 0, "scroll": 0, "expand_row": 0}

    async def expand_comments(*_a, **_k):
        calls["expand"] += 1

    async def scroll_to_element(*_a, **_k):
        calls["scroll"] += 1

    async def expand_row(*_a, **_k):
        calls["expand_row"] += 1
        return 1 if calls["expand_row"] == 1 else 0

    monkeypatch.setattr(cvh, "expand_comments", expand_comments)
    monkeypatch.setattr(cvh, "scroll_to_element", scroll_to_element)
    monkeypatch.setattr(cvh, "expand_comment_row_text", expand_row)
    monkeypatch.setattr(cvh, "safe_wait", _noop)

    asyncio.run(cvh.prepare_comment_for_capture(object(), object(), object()))
    assert calls["expand"] == 1
    assert calls["scroll"] >= 1
    assert calls["expand_row"] >= 2


def test_ensure_highlight_ready_retries(monkeypatch):
    seq = [{"ok": False, "reason": "x"}, {"ok": True}]

    async def highlight(*_a, **_k):
        return seq.pop(0)

    monkeypatch.setattr(cvh, "force_light_mode", _noop)
    monkeypatch.setattr(cvh, "hide_visual_overlays", _noop)
    monkeypatch.setattr(cvh, "scroll_to_element", _noop)
    monkeypatch.setattr(cvh, "safe_wait", _noop)
    monkeypatch.setattr(cvh, "highlight", highlight)

    out = asyncio.run(
        cvh.ensure_highlight_ready(
            page=object(),
            element_handle=object(),
            data={"username": "u"},
            comment_container=object(),
        )
    )
    assert out["ok"] is True


def test_handle_highlight_failure_rolls_back(monkeypatch):
    calls = {"dec": 0, "rb": 0, "dbg": 0}

    monkeypatch.setattr(cvh, "decrement_comment_counters", lambda st: calls.__setitem__("dec", calls["dec"] + 1))
    monkeypatch.setattr(cvh, "rollback_comment_seen", lambda *_a, **_k: calls.__setitem__("rb", calls["rb"] + 1))

    async def dump(*_a, **_k):
        calls["dbg"] += 1

    monkeypatch.setattr(cvh, "dump_skip_debug", dump)

    state = {"count": 3, "new_in_round": 1}
    asyncio.run(
        cvh.handle_highlight_failure(
            page=object(),
            kv_store=object(),
            state=state,
            data={"username": "u"},
            highlight_result={"ok": False, "reason": "missing"},
            strict_key="s",
            loose_key="l",
            comment_uid="u1",
            screenshot_timeout_ms=1000,
        )
    )
    assert calls == {"dec": 1, "rb": 1, "dbg": 1}


def test_get_geometry_fallback_metrics_parses_result():
    page = FakePage(eval_results=[{"risk": True, "ratio": 1.7}])
    risk, ratio = asyncio.run(cvh.get_geometry_fallback_metrics(page, object()))
    assert risk is True
    assert ratio == 1.7
