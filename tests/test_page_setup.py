import asyncio

import src.page_setup as ps


class FakePage:
    def __init__(self, time_count=0, eval_raises=False):
        self.time_count = time_count
        self.eval_raises = eval_raises
        self.waits = []

    async def eval_on_selector_all(self, _selector, _expr):
        return self.time_count

    async def wait_for_timeout(self, ms):
        self.waits.append(ms)

    async def evaluate(self, _script, _arg=None):
        if self.eval_raises:
            raise RuntimeError("boom")
        return None


def test_prepare_comments_page_happy_path(monkeypatch):
    page = FakePage(time_count=0)
    calls = {k: 0 for k in ["light", "cookie", "dismiss", "open", "load", "scroll", "expand", "container"]}

    async def force_light_mode(_p):
        calls["light"] += 1

    async def handle_cookie_banner(_p):
        calls["cookie"] += 1

    async def dismiss_login_wall(_p):
        calls["dismiss"] += 1

    async def open_comments_panel(_p, **_kwargs):
        calls["open"] += 1

    async def load_all_comments(_p, _max, _idle, **_kwargs):
        calls["load"] += 1

    async def auto_scroll(_p, _r):
        calls["scroll"] += 1

    async def expand_comments(_p, _n, **_kwargs):
        calls["expand"] += 1

    async def get_comment_container(_p):
        calls["container"] += 1
        return "C"

    monkeypatch.setattr(ps, "force_light_mode", force_light_mode)
    monkeypatch.setattr(ps, "handle_cookie_banner", handle_cookie_banner)
    monkeypatch.setattr(ps, "dismiss_login_wall", dismiss_login_wall)
    monkeypatch.setattr(ps, "open_comments_panel", open_comments_panel)
    monkeypatch.setattr(ps, "load_all_comments", load_all_comments)
    monkeypatch.setattr(ps, "auto_scroll", auto_scroll)
    monkeypatch.setattr(ps, "expand_comments", expand_comments)
    monkeypatch.setattr(ps, "get_comment_container", get_comment_container)

    asyncio.run(ps.prepare_comments_page(page=page, max_ui_rounds=5, ui_idle_rounds=2, load_timeout_secs=5))

    assert calls["light"] >= 2
    assert calls["cookie"] == 1
    assert calls["open"] >= 2  # second open because time count == 0
    assert calls["load"] == 1
    assert calls["expand"] == 1
    assert calls["container"] == 1


def test_prepare_comments_page_swallow_evaluate_error(monkeypatch):
    page = FakePage(time_count=1, eval_raises=True)

    async def noop(*_args, **_kwargs):
        return None

    monkeypatch.setattr(ps, "force_light_mode", noop)
    monkeypatch.setattr(ps, "handle_cookie_banner", noop)
    monkeypatch.setattr(ps, "dismiss_login_wall", noop)
    monkeypatch.setattr(ps, "open_comments_panel", noop)
    monkeypatch.setattr(ps, "load_all_comments", noop)
    monkeypatch.setattr(ps, "auto_scroll", noop)
    monkeypatch.setattr(ps, "expand_comments", noop)

    async def get_comment_container(_p):
        return "C"

    monkeypatch.setattr(ps, "get_comment_container", get_comment_container)

    asyncio.run(ps.prepare_comments_page(page=page, max_ui_rounds=5, ui_idle_rounds=2, load_timeout_secs=5))
    # no exception means pass
