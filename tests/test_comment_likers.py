import asyncio

import src.comment_likers as cl


class FakeKeyboard:
    def __init__(self):
        self.pressed = []

    async def press(self, key):
        self.pressed.append(key)


class FakeContext:
    async def new_page(self):
        raise AssertionError("fallback page should not be opened in this test")


class FakePage:
    def __init__(self, eval_results=None):
        self.eval_results = list(eval_results or [])
        self.waits = []
        self.keyboard = FakeKeyboard()
        self.context = FakeContext()

    async def evaluate(self, _script, _arg=None):
        if self.eval_results:
            return self.eval_results.pop(0)
        return False

    async def wait_for_timeout(self, ms):
        self.waits.append(ms)


def test_collect_open_likers_dialog_dedupes_and_respects_limit():
    page = FakePage(
        eval_results=[
            {
                "open": True,
                "items": [
                    {"username": "Alice", "profilePath": "/alice/"},
                    {"username": "alice", "profilePath": "/alice/"},
                    {"username": "Bob", "profilePath": "https://www.instagram.com/bob/"},
                ],
                "canScroll": True,
            },
            {"open": True, "items": [], "canScroll": False},
        ]
    )

    out = asyncio.run(cl._collect_open_likers_dialog(page, max_comment_likers=2))
    assert out == [
        {"username": "Alice", "profileUrl": "https://www.instagram.com/alice/"},
        {"username": "Bob", "profileUrl": "https://www.instagram.com/bob/"},
    ]


def test_enrich_comment_likers_returns_early_without_element_handle():
    data = {"username": "u"}
    out = asyncio.run(cl.enrich_comment_likers(FakePage(), None, data.copy()))
    assert out == data


def test_enrich_comment_likers_no_click_keeps_empty_likers(monkeypatch):
    page = FakePage()

    async def fake_open(*_args, **_kwargs):
        return {"ok": True, "clicked": False, "likesCount": 4, "reason": "not_found"}

    async def fail_collect(*_args, **_kwargs):
        raise AssertionError("should not collect when no dialog click happened")

    monkeypatch.setattr(cl, "_open_likes_in_current_page", fake_open)
    monkeypatch.setattr(cl, "_collect_open_likers_dialog", fail_collect)

    data = {"username": "u", "commentPermalink": "/p/x/c/1/"}
    out = asyncio.run(cl.enrich_comment_likers(page, object(), data, max_comment_likers=10))

    assert out["likesCount"] == 4
    assert out["commentLikers"] == []


def test_enrich_comment_likers_click_collects_and_closes_dialog(monkeypatch):
    page = FakePage(eval_results=[None, True])  # guard check, then dialog open check

    async def fake_open(*_args, **_kwargs):
        return {"ok": True, "clicked": True, "likesCount": 2, "reason": "clicked"}

    async def fake_collect(*_args, **_kwargs):
        return [{"username": "alice", "profileUrl": "https://www.instagram.com/alice/"}]

    monkeypatch.setattr(cl, "_open_likes_in_current_page", fake_open)
    monkeypatch.setattr(cl, "_collect_open_likers_dialog", fake_collect)

    data = {"username": "u", "commentPermalink": "/p/x/c/1/"}
    out = asyncio.run(cl.enrich_comment_likers(page, object(), data, max_comment_likers=10))

    assert out["likesCount"] == 2
    assert len(out["commentLikers"]) == 1
    assert page.keyboard.pressed == ["Escape"]
