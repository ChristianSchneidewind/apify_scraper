import asyncio

import src.multipart_planner as mp


class FakePage:
    def __init__(self, evaluate_results=None):
        self.evaluate_results = list(evaluate_results or [])
        self.waits = []

    async def evaluate(self, _script, _arg=None):
        if self.evaluate_results:
            return self.evaluate_results.pop(0)
        return None

    async def wait_for_timeout(self, ms):
        self.waits.append(ms)


def test_build_comment_locator_payload():
    el = object()
    out = mp.build_comment_locator_payload(
        {
            "commentPermalink": "/p/x/c/1/",
            "userProfilePath": "/alice/",
            "username": "alice",
            "text": "hello",
        },
        el,
    )
    assert out["el"] is el
    assert out["username"] == "alice"


def test_plan_comment_multipart_defaults_when_plan_not_ok(monkeypatch):
    page = FakePage(evaluate_results=[{"ok": False}])

    monkeypatch.setattr(mp, "should_force_row_multipart", lambda **_k: False)
    monkeypatch.setattr(mp, "calc_total_parts", lambda parts: len(parts) or 1)
    monkeypatch.setattr(mp, "should_use_3plus_route", lambda total: total >= 3)

    out = asyncio.run(
        mp.plan_comment_multipart(
            page=page,
            element_handle=object(),
            data={"text": "short"},
            state={"count": 1},
        )
    )

    assert out["mode"] == "single"
    assert out["scroll_parts"] == [0]
    assert out["total_parts"] == 1
    assert out["use_3plus_route"] is False


def test_plan_comment_multipart_forced_row_for_long_text(monkeypatch):
    # first evaluate call = long-text pre-expand (ignored return), second = part_plan
    page = FakePage(evaluate_results=[None, {"ok": True, "mode": "single", "tops": [0], "sig": "abc"}])

    monkeypatch.setattr(mp, "LONG_TEXT_THRESHOLD", 10)
    monkeypatch.setattr(mp, "FORCED_MULTIPART_BASE", 10)
    monkeypatch.setattr(mp, "should_force_row_multipart", lambda **_k: True)
    monkeypatch.setattr(mp, "calc_forced_parts", lambda **_k: 4)
    monkeypatch.setattr(mp, "calc_total_parts", lambda parts: len(parts))
    monkeypatch.setattr(mp, "should_use_3plus_route", lambda total: total >= 3)

    out = asyncio.run(
        mp.plan_comment_multipart(
            page=page,
            element_handle=object(),
            data={"text": "this is definitely long"},
            state={"count": 7},
        )
    )

    assert out["mode"] == "row"
    assert out["scroll_parts"] == [0, 1, 2, 3]
    assert out["total_parts"] == 4
    assert out["use_3plus_route"] is True
    assert page.waits == [160]


def test_plan_comment_multipart_uses_part_plan_when_not_forced(monkeypatch):
    page = FakePage(evaluate_results=[{"ok": True, "mode": "inner", "tops": [0, 100], "sig": "s1"}])

    monkeypatch.setattr(mp, "LONG_TEXT_THRESHOLD", 999)
    monkeypatch.setattr(mp, "should_force_row_multipart", lambda **_k: False)
    monkeypatch.setattr(mp, "calc_total_parts", lambda parts: len(parts))
    monkeypatch.setattr(mp, "should_use_3plus_route", lambda total: total >= 3)

    out = asyncio.run(
        mp.plan_comment_multipart(
            page=page,
            element_handle=object(),
            data={"text": "short"},
            state={"count": 2},
        )
    )

    assert out["mode"] == "inner"
    assert out["base_sig"] == "s1"
    assert out["scroll_parts"] == [0, 100]
    assert out["total_parts"] == 2
    assert out["use_3plus_route"] is False
