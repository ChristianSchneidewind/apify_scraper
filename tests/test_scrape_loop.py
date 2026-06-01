import asyncio
from types import SimpleNamespace

import src.scrape_loop as sl


class FakePage:
    def __init__(self, *, time_handles=None, scrolled=True):
        self._time_handles = time_handles or []
        self.scrolled = scrolled

    async def query_selector_all(self, _selector):
        return self._time_handles

    async def evaluate(self, _script, _arg=None):
        return self.scrolled

    async def wait_for_timeout(self, _ms):
        return None


async def _noop(*_args, **_kwargs):
    return None


async def _empty_list(*_args, **_kwargs):
    return []


def _ctx(url="https://www.instagram.com/p/abc/"):
    return SimpleNamespace(request=SimpleNamespace(url=url))


def test_scrape_loop_stops_at_max_comments(monkeypatch):
    page = FakePage()

    async def get_rows(*_args, **_kwargs):
        return ["row1", "row2", "row3"]

    async def extract_from_item(row):
        return ({"id": row, "new": True}, object())

    def build_process_candidate(**kwargs):
        state = kwargs["state"]

        async def process(data, _element):
            if data.get("new"):
                state["count"] += 1
                state["new_in_round"] += 1

        return process

    monkeypatch.setattr(sl, "get_comment_container", _noop)
    monkeypatch.setattr(sl, "expand_comments", _noop)
    monkeypatch.setattr(sl, "expand_all_reply_threads", _noop)
    monkeypatch.setattr(sl, "get_post_comment_rows", get_rows)
    monkeypatch.setattr(sl, "get_dialog_comment_rows", _empty_list)
    monkeypatch.setattr(sl, "extract_comment_from_item", extract_from_item)
    monkeypatch.setattr(sl, "extract_comment_from_time", lambda *_: (_ for _ in ()).throw(AssertionError("should not be used")))
    monkeypatch.setattr(sl, "build_process_candidate", build_process_candidate)

    count = asyncio.run(
        sl.run_comment_capture_loop(
            page=page,
            context=_ctx(),
            dataset=None,
            kv_store=None,
            run_folder="run",
            screenshot_timeout_ms=1000,
            log_every_n_screenshots=10,
            max_comments=2,
            max_ui_rounds=5,
            ui_idle_rounds=3,
            no_new_rounds_before_rescan=5,
            max_rescan_passes=0,
            max_comment_likers=0,
        )
    )

    assert count == 2


def test_scrape_loop_uses_time_fallback_when_rows_have_no_new(monkeypatch):
    page = FakePage(time_handles=["t1", "t2"])

    async def get_rows(*_args, **_kwargs):
        return ["row"]

    async def extract_from_item(_row):
        return ({"new": False}, object())

    async def extract_from_time(handle):
        return ({"new": handle == "t1"}, object())

    def build_process_candidate(**kwargs):
        state = kwargs["state"]

        async def process(data, _element):
            if data.get("new"):
                state["count"] += 1
                state["new_in_round"] += 1

        return process

    monkeypatch.setattr(sl, "get_comment_container", _noop)
    monkeypatch.setattr(sl, "expand_comments", _noop)
    monkeypatch.setattr(sl, "expand_all_reply_threads", _noop)
    monkeypatch.setattr(sl, "get_post_comment_rows", get_rows)
    monkeypatch.setattr(sl, "get_dialog_comment_rows", _empty_list)
    monkeypatch.setattr(sl, "extract_comment_from_item", extract_from_item)
    monkeypatch.setattr(sl, "extract_comment_from_time", extract_from_time)
    monkeypatch.setattr(sl, "build_process_candidate", build_process_candidate)

    count = asyncio.run(
        sl.run_comment_capture_loop(
            page=page,
            context=_ctx(),
            dataset=None,
            kv_store=None,
            run_folder="run",
            screenshot_timeout_ms=1000,
            log_every_n_screenshots=10,
            max_comments=0,
            max_ui_rounds=1,
            ui_idle_rounds=3,
            no_new_rounds_before_rescan=5,
            max_rescan_passes=0,
            max_comment_likers=0,
        )
    )

    assert count == 1


def test_scrape_loop_triggers_rescan_and_stops_if_no_gain(monkeypatch):
    page = FakePage(time_handles=[])
    calls = {"load_all_comments": 0, "expand_comments": 0}

    async def get_rows(*_args, **_kwargs):
        return ["row"]

    async def extract_from_item(_row):
        return ({"new": False}, object())

    def build_process_candidate(**kwargs):
        async def process(_data, _element):
            return None

        return process

    async def load_all_comments(*_args, **_kwargs):
        calls["load_all_comments"] += 1

    async def expand_comments(*_args, **_kwargs):
        calls["expand_comments"] += 1

    monkeypatch.setattr(sl, "get_comment_container", _noop)
    monkeypatch.setattr(sl, "expand_comments", expand_comments)
    monkeypatch.setattr(sl, "expand_all_reply_threads", _noop)
    monkeypatch.setattr(sl, "get_post_comment_rows", get_rows)
    monkeypatch.setattr(sl, "get_dialog_comment_rows", _empty_list)
    monkeypatch.setattr(sl, "extract_comment_from_item", extract_from_item)
    monkeypatch.setattr(sl, "extract_comment_from_time", _empty_list)
    monkeypatch.setattr(sl, "build_process_candidate", build_process_candidate)
    monkeypatch.setattr(sl, "load_all_comments", load_all_comments)
    monkeypatch.setattr(sl, "open_comments_panel", _noop)
    monkeypatch.setattr(sl, "dismiss_login_wall", _noop)

    count = asyncio.run(
        sl.run_comment_capture_loop(
            page=page,
            context=_ctx(),
            dataset=None,
            kv_store=None,
            run_folder="run",
            screenshot_timeout_ms=1000,
            log_every_n_screenshots=10,
            max_comments=0,
            max_ui_rounds=10,
            ui_idle_rounds=10,
            no_new_rounds_before_rescan=1,
            max_rescan_passes=1,
            max_comment_likers=0,
        )
    )

    assert count == 0
    assert calls["load_all_comments"] == 1
    assert calls["expand_comments"] < 10
