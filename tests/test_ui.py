import asyncio

import src.ui as ui


class FakeLocator:
    def __init__(self, count=0, click_raises=False):
        self._count = count
        self._click_raises = click_raises
        self.first = self

    async def count(self):
        return self._count

    async def click(self, timeout=None):
        if self._click_raises:
            raise RuntimeError("click failed")


class FakePage:
    def __init__(self, evaluate_results=None, time_counts=None, locator_count=0):
        self.evaluate_results = list(evaluate_results or [])
        self.time_counts = list(time_counts or [])
        self.waits = []
        self.locator_count = locator_count
        self.scripts = []

    async def evaluate(self, script, _arg=None):
        self.scripts.append(script)
        if self.evaluate_results:
            return self.evaluate_results.pop(0)
        return None

    async def wait_for_timeout(self, ms):
        self.waits.append(ms)

    def locator(self, _selector):
        return FakeLocator(count=self.locator_count)

    async def eval_on_selector_all(self, _selector, _expr):
        if self.time_counts:
            return self.time_counts.pop(0)
        return 0

    async def emulate_media(self, **_kwargs):
        return None

    async def add_init_script(self, _script):
        return None

    async def evaluate_handle(self, _script):
        return "HANDLE"


def test_open_comments_panel_returns_after_inpage_click():
    page = FakePage(evaluate_results=[True])
    asyncio.run(ui.open_comments_panel(page))
    assert page.waits == [1500]
    assert any("isSaneClickTarget" in script for script in page.scripts)


def test_open_comments_panel_falls_back_to_locator_click():
    page = FakePage(evaluate_results=[False], locator_count=1)
    asyncio.run(ui.open_comments_panel(page))
    assert 1200 in page.waits


def test_open_comments_panel_safe_mode_skips_inpage_click():
    page = FakePage(evaluate_results=[True], locator_count=1)
    asyncio.run(ui.open_comments_panel(page, safe_mode=True))
    assert 1200 in page.waits


def test_open_comments_panel_retries_after_suspicious_inpage_click(monkeypatch):
    page = FakePage(evaluate_results=[True], locator_count=1)
    responses = iter([True, False])

    async def fake_dismiss(_page, *, source):
        return next(responses)

    monkeypatch.setattr(ui, "dismiss_suspicious_dialog_if_present", fake_dismiss)

    asyncio.run(ui.open_comments_panel(page))

    assert 1200 in page.waits


def test_open_comments_panel_skips_suspicious_selector_click(monkeypatch):
    page = FakePage(evaluate_results=[False], locator_count=1)

    async def fake_dismiss(_page, *, source):
        return True

    monkeypatch.setattr(ui, "dismiss_suspicious_dialog_if_present", fake_dismiss)

    asyncio.run(ui.open_comments_panel(page))

    assert 1200 not in page.waits


def test_expand_comments_stops_when_no_clicks():
    page = FakePage(evaluate_results=[0])
    asyncio.run(ui.expand_comments(page, max_clicks=10))
    assert page.waits == []
    assert any("isSaneClickTarget" in script for script in page.scripts)


def test_expand_comments_safe_mode_caps_click_rounds(monkeypatch):
    page = FakePage(evaluate_results=[1] * 20)

    async def fake_dismiss(_page, *, source):
        return False

    monkeypatch.setattr(ui, "dismiss_suspicious_dialog_if_present", fake_dismiss)

    asyncio.run(ui.expand_comments(page, max_clicks=20, safe_mode=True))

    assert len(page.waits) == 8


def test_expand_comments_stops_after_suspicious_dialog(monkeypatch):
    page = FakePage(evaluate_results=[2])

    async def fake_dismiss(_page, *, source):
        return True

    monkeypatch.setattr(ui, "dismiss_suspicious_dialog_if_present", fake_dismiss)

    asyncio.run(ui.expand_comments(page, max_clicks=10))

    assert page.waits == []


def test_auto_scroll_breaks_when_not_scrolled():
    page = FakePage(evaluate_results=[False])
    asyncio.run(ui.auto_scroll(page, rounds=5))
    assert page.waits == []


def test_load_all_comments_increments_idle_and_calls_helpers(monkeypatch):
    page = FakePage(time_counts=[0, 1, 1])
    calls = {"open": 0, "dismiss": 0, "expand": 0, "scroll": 0, "auto": 0}

    async def open_comments_panel(_p, **_kwargs):
        calls["open"] += 1

    async def dismiss_login_wall(_p):
        calls["dismiss"] += 1

    async def expand_comments(_p, _n, **_kwargs):
        calls["expand"] += 1

    async def scroll_comment_container(_p, _n):
        calls["scroll"] += 1

    async def auto_scroll(_p, _n):
        calls["auto"] += 1

    monkeypatch.setattr(ui, "open_comments_panel", open_comments_panel)
    monkeypatch.setattr(ui, "dismiss_login_wall", dismiss_login_wall)
    monkeypatch.setattr(ui, "expand_comments", expand_comments)
    monkeypatch.setattr(ui, "scroll_comment_container", scroll_comment_container)
    monkeypatch.setattr(ui, "auto_scroll", auto_scroll)

    asyncio.run(ui.load_all_comments(page, max_rounds=3, idle_rounds=1))

    assert calls["open"] >= 1
    assert calls["expand"] >= 1
    assert calls["scroll"] >= 1
    assert calls["auto"] >= 1


def test_get_comment_container_returns_handle():
    page = FakePage()
    out = asyncio.run(ui.get_comment_container(page))
    assert out == "HANDLE"
