import asyncio

import src.session as session


class FakeLoginPage:
    def __init__(self):
        self.closed = False

    async def close(self):
        self.closed = True


class FakeContext:
    def __init__(self):
        self.cookies_added = []
        self.storage_state_data = {"cookies": [{"name": "s", "value": "1"}]}
        self.login_page = None

    async def add_cookies(self, cookies):
        self.cookies_added.append(cookies)

    async def new_page(self):
        self.login_page = FakeLoginPage()
        return self.login_page

    async def storage_state(self):
        return self.storage_state_data


class FakePage:
    def __init__(self):
        self.context = FakeContext()


class FakeKvStore:
    def __init__(self):
        self.calls = []

    async def set_value(self, key, value, content_type=None):
        self.calls.append((key, value, content_type))


def test_init_session_state():
    state = session.init_session_state({"cookies": []})
    assert state["login_done"] is False
    assert state["cookies_loaded"] is False
    assert state["stored_state_data"] == {"cookies": []}


def test_apply_login_session_loads_cookies_once_without_login(monkeypatch):
    page = FakePage()
    kv = FakeKvStore()
    state = session.init_session_state({"cookies": [{"name": "a", "value": "b"}]})

    async def fail_if_called(*_args, **_kwargs):
        raise AssertionError("ensure_logged_in should not be called")

    monkeypatch.setattr(session, "ensure_logged_in", fail_if_called)

    asyncio.run(
        session.apply_login_session(
            page=page,
            kv_store=kv,
            session_state=state,
            login_enabled=False,
            login_username=None,
            login_password=None,
            login_state_key="LOGIN_STATE",
            save_login_state=True,
            screenshot_timeout_ms=1000,
        )
    )

    assert state["cookies_loaded"] is True
    assert len(page.context.cookies_added) == 1
    assert kv.calls == []

    asyncio.run(
        session.apply_login_session(
            page=page,
            kv_store=kv,
            session_state=state,
            login_enabled=False,
            login_username=None,
            login_password=None,
            login_state_key="LOGIN_STATE",
            save_login_state=True,
            screenshot_timeout_ms=1000,
        )
    )

    assert len(page.context.cookies_added) == 1


def test_apply_login_session_performs_login_and_saves_state(monkeypatch):
    page = FakePage()
    kv = FakeKvStore()
    state = session.init_session_state(None)
    called = {"ensure": 0}

    async def fake_ensure(login_page, kv_store, username, password, timeout_ms):
        called["ensure"] += 1
        assert login_page is page.context.login_page
        assert kv_store is kv
        assert username == "u"
        assert password == "p"
        assert timeout_ms == 5000

    monkeypatch.setattr(session, "ensure_logged_in", fake_ensure)

    asyncio.run(
        session.apply_login_session(
            page=page,
            kv_store=kv,
            session_state=state,
            login_enabled=True,
            login_username="u",
            login_password="p",
            login_state_key="LOGIN_STATE",
            save_login_state=True,
            screenshot_timeout_ms=5000,
        )
    )

    assert called["ensure"] == 1
    assert state["login_done"] is True
    assert state["stored_state_data"] == page.context.storage_state_data
    assert page.context.login_page.closed is True
    assert kv.calls == [
        ("LOGIN_STATE", page.context.storage_state_data, "application/json")
    ]


def test_apply_login_session_login_without_save_state(monkeypatch):
    page = FakePage()
    kv = FakeKvStore()
    state = session.init_session_state(None)

    async def fake_ensure(*_args, **_kwargs):
        return None

    monkeypatch.setattr(session, "ensure_logged_in", fake_ensure)

    asyncio.run(
        session.apply_login_session(
            page=page,
            kv_store=kv,
            session_state=state,
            login_enabled=True,
            login_username="u",
            login_password="p",
            login_state_key="LOGIN_STATE",
            save_login_state=False,
            screenshot_timeout_ms=5000,
        )
    )

    assert state["login_done"] is True
    assert kv.calls == []
