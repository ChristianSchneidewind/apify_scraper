import asyncio

import src.comment_state as cs


class FakePage:
    def __init__(self, uid="uid-1"):
        self.uid = uid

    async def evaluate(self, _script, _element):
        return self.uid


def _state():
    return {
        "count": 0,
        "new_in_round": 0,
        "last_screenshot_hash": None,
        "seen_strict": set(),
        "seen_loose": set(),
        "seen_comment_uid": set(),
    }


def test_build_comment_identity_text_and_gif_modes():
    strict, loose = cs.build_comment_identity(
        {"username": " Alice ", "text": " Hi ", "datetime": "2026", "timeText": "1d", "isGifOnly": False}
    )
    assert strict == "alice|hi|2026"
    assert loose == "txt|alice|hi|1d"

    strict2, loose2 = cs.build_comment_identity(
        {"username": "Bob", "text": "[GIF]", "datetime": "", "timeText": "2h", "isGifOnly": True}
    )
    assert strict2 == "bob|[gif]|"
    assert loose2 == "gif|bob|2h"


def test_register_and_rollback_seen_sets():
    st = _state()
    cs.register_comment_seen(st, "s", "l", "u")
    assert "s" in st["seen_strict"]
    assert "l" in st["seen_loose"]
    assert "u" in st["seen_comment_uid"]

    cs.rollback_comment_seen(st, "s", "l", "u")
    assert "s" not in st["seen_strict"]
    assert "l" not in st["seen_loose"]
    assert "u" not in st["seen_comment_uid"]


def test_increment_and_decrement_counters():
    st = _state()
    cs.increment_comment_counters(st)
    assert st["count"] == 1 and st["new_in_round"] == 1
    cs.decrement_comment_counters(st)
    assert st["count"] == 0 and st["new_in_round"] == 0


def test_register_candidate_or_skip_paths():
    st = _state()
    page = FakePage("uid-a")
    data = {"username": "u", "text": "t", "datetime": "d", "timeText": "tt"}

    ok, strict_key, loose_key, uid = asyncio.run(cs.register_candidate_or_skip(page, st, data, object()))
    assert ok is True
    assert uid == "uid-a"
    assert strict_key in st["seen_strict"]
    assert loose_key in st["seen_loose"]

    # strict/loose duplicate
    ok2, *_ = asyncio.run(cs.register_candidate_or_skip(page, st, data, object()))
    assert ok2 is False

    # new keys but duplicate uid
    st2 = _state()
    st2["seen_comment_uid"].add("uid-a")
    ok3, _s3, _l3, uid3 = asyncio.run(
        cs.register_candidate_or_skip(page, st2, {"username": "x", "text": "y", "datetime": "z"}, object())
    )
    assert ok3 is False
    assert uid3 == "uid-a"
