import asyncio
import importlib
from types import SimpleNamespace


class FakeStore:
    def __init__(self):
        self.data = {}
        self.set_calls = []

    async def get_value(self, key):
        return self.data.get(key)

    async def set_value(self, key, value, content_type=None):
        self.data[key] = value
        self.set_calls.append((key, content_type))


class FakeDataset:
    async def push_data(self, _item):
        return None


class FakeActorCM:
    def __init__(self):
        self.input_data = {}
        self.default_store = FakeStore()
        self.meta_store = FakeStore()
        self.log = SimpleNamespace(info=lambda *a, **k: None, warning=lambda *a, **k: None)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get_input(self):
        return self.input_data

    async def open_dataset(self):
        return FakeDataset()

    async def open_key_value_store(self, name=None):
        return self.meta_store if name == "video_meta" else self.default_store


class FakePage:
    def __init__(self):
        self.url = ""

    async def goto(self, url, wait_until=None):
        self.url = url

    async def wait_for_timeout(self, _ms):
        return None


class FakeRouter:
    def __init__(self):
        self.handler = None

    def default_handler(self, fn):
        self.handler = fn
        return fn


class FakeCrawler:
    instances = []

    def __init__(self, **kwargs):
        self.kwargs = kwargs
        self.router = FakeRouter()
        FakeCrawler.instances.append(self)

    async def run(self, urls):
        for u in urls:
            ctx = SimpleNamespace(request=SimpleNamespace(url=u), page=FakePage())
            await self.router.handler(ctx)


def _cfg(urls):
    return {
        "urls": urls,
        "max_comments": 0,
        "max_ui_rounds": 1,
        "ui_idle_rounds": 1,
        "load_timeout_secs": 1,
        "screenshot_timeout_ms": 1000,
        "request_handler_timeout_secs": 60,
        "login_enabled": False,
        "login_username": None,
        "login_password": None,
        "login_state_key": "LOGIN_STATE",
        "save_login_state": False,
        "headful": False,
        "window_pos_x": 0,
        "window_pos_y": 0,
        "slow_mo_ms": 0,
        "debug_network": False,
        "log_every_n_screenshots": 10,
        "debug_har": False,
        "debug_devtools": False,
        "manual_debug_mode": False,
        "manual_debug_only": False,
        "manual_debug_pause_secs": 1,
        "force_single_concurrency": True,
        "safe_interaction_mode": False,
        "no_new_rounds_before_rescan": 1,
        "max_rescan_passes": 0,
        "max_comment_likers": 0,
        "liker_collection_mode": "best_effort",
        "viewport_width": 1080,
        "viewport_height": 1800,
        "maximize_window": False,
    }


def test_main_raises_on_empty_urls(monkeypatch):
    m = importlib.import_module("main")
    actor = FakeActorCM()
    monkeypatch.setattr(m, "Actor", actor)
    monkeypatch.setattr(m, "parse_input", lambda _i: _cfg([]))

    from src.errors import InputValidationError

    try:
        asyncio.run(m.main())
        assert False, "expected InputValidationError"
    except InputValidationError as e:
        assert "urls" in str(e)


def test_main_happy_path_runs_crawler(monkeypatch):
    m = importlib.import_module("main")
    actor = FakeActorCM()
    monkeypatch.setattr(m, "Actor", actor)
    monkeypatch.setattr(m, "PlaywrightCrawler", FakeCrawler)
    monkeypatch.setattr(m, "parse_input", lambda _i: _cfg(["https://www.instagram.com/p/abc/"]))
    monkeypatch.setattr(m, "init_session_state", lambda _s: {})
    async def _noop(*_a, **_k):
        return None

    async def _run_loop(*_a, **_k):
        return 1

    monkeypatch.setattr(m, "apply_login_session", _noop)
    monkeypatch.setattr(m, "force_light_mode", _noop)
    monkeypatch.setattr(m, "prepare_comments_page", _noop)
    monkeypatch.setattr(m, "run_comment_capture_loop", _run_loop)
    monkeypatch.setattr(m, "make_post_slug", lambda _u: "slug")

    asyncio.run(m.main())

    assert FakeCrawler.instances
    crawler = FakeCrawler.instances[-1]
    assert crawler.kwargs["max_requests_per_crawl"] == 1
    assert actor.meta_store.set_calls
    assert any(key.startswith("RUN_SUMMARY::") and ctype == "application/json" for key, ctype in actor.default_store.set_calls)
