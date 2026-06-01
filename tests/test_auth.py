import asyncio

import pytest

import src.auth as auth
from src.errors import LoginError


class FakeLocator:
    def __init__(self, count=0, visible=True, wait_raises=False):
        self._count = count
        self._visible = visible
        self._wait_raises = wait_raises
        self.first = self
        self.clicked = 0
        self.filled = []
        self.pressed = []

    async def count(self):
        return self._count

    async def is_visible(self):
        return self._visible

    async def click(self, timeout=None):
        self.clicked += 1

    async def wait_for(self, timeout=None):
        if self._wait_raises:
            raise RuntimeError("no form")

    async def fill(self, val):
        self.filled.append(val)

    async def press(self, key):
        self.pressed.append(key)


class FakePage:
    def __init__(self):
        self.waits = []
        self.gotos = []
        self.evaluated = 0
        self._locators = {}

    def set_locator(self, sel, loc):
        self._locators[sel] = loc

    def locator(self, sel):
        return self._locators.get(sel, FakeLocator(0))

    async def wait_for_timeout(self, ms):
        self.waits.append(ms)

    async def evaluate(self, _script):
        self.evaluated += 1

    async def goto(self, url, wait_until=None):
        self.gotos.append(url)

    async def screenshot(self, full_page=True, timeout=None):
        return b"img"

    async def content(self):
        return "<html></html>"

    async def wait_for_selector(self, *_args, **_kwargs):
        return None


class FakeKv:
    def __init__(self):
        self.saved = []

    async def set_value(self, key, value, content_type=None):
        self.saved.append((key, content_type))


def test_handle_cookie_banner_clicks_visible_button_and_returns():
    p = FakePage()
    p.set_locator('button:has-text("Allow all cookies")', FakeLocator(count=1, visible=True))

    asyncio.run(auth.handle_cookie_banner(p))

    assert p.waits == [1500]


def test_handle_cookie_banner_no_match_waits_full_loop():
    p = FakePage()

    asyncio.run(auth.handle_cookie_banner(p))

    assert p.waits == [1000, 1000, 1000, 1000, 1000]


def test_dismiss_login_wall_runs_script():
    p = FakePage()
    asyncio.run(auth.dismiss_login_wall(p))
    assert p.evaluated == 1


def test_ensure_logged_in_requires_credentials():
    with pytest.raises(LoginError):
        asyncio.run(auth.ensure_logged_in(FakePage(), FakeKv(), None, None, 1000))


def test_ensure_logged_in_returns_when_already_logged(monkeypatch):
    p = FakePage()
    p.set_locator('nav, svg[aria-label="Home"], svg[aria-label="Profile"]', FakeLocator(count=1))

    async def noop(_p):
        return None

    monkeypatch.setattr(auth, "handle_cookie_banner", noop)

    asyncio.run(auth.ensure_logged_in(p, FakeKv(), "u", "p", 1000))
    assert p.gotos[0] == "https://www.instagram.com/"


def test_ensure_logged_in_success_path(monkeypatch):
    p = FakePage()

    async def noop(_p):
        return None

    monkeypatch.setattr(auth, "handle_cookie_banner", noop)

    p.set_locator('nav, svg[aria-label="Home"], svg[aria-label="Profile"]', FakeLocator(count=0))
    p.set_locator('a[href^="/accounts/login/"]', FakeLocator(count=1))
    user = FakeLocator(count=1)
    pwd = FakeLocator(count=1)
    p.set_locator('input[name="username"], input[autocomplete="username"], input[type="text"]', user)
    p.set_locator('input[name="password"], input[autocomplete="current-password"], input[type="password"]', pwd)

    asyncio.run(auth.ensure_logged_in(p, FakeKv(), "u", "p", 1000))

    assert user.filled == ["u"]
    assert pwd.filled == ["p"]
    assert pwd.pressed == ["Enter"]


def test_ensure_logged_in_login_form_missing_saves_debug(monkeypatch):
    p = FakePage()
    kv = FakeKv()

    async def noop(_p):
        return None

    monkeypatch.setattr(auth, "handle_cookie_banner", noop)

    p.set_locator('nav, svg[aria-label="Home"], svg[aria-label="Profile"]', FakeLocator(count=0))
    p.set_locator('a[href^="/accounts/login/"]', FakeLocator(count=0))
    p.set_locator('input[name="username"], input[autocomplete="username"], input[type="text"]', FakeLocator(count=1, wait_raises=True))
    p.set_locator('input[name="password"], input[autocomplete="current-password"], input[type="password"]', FakeLocator(count=1))

    with pytest.raises(LoginError):
        asyncio.run(auth.ensure_logged_in(p, kv, "u", "p", 1000))

    assert len(kv.saved) == 2
