import asyncio

from src.flow_utils import retry_async, safe_wait, swallowed


class FakePage:
    def __init__(self):
        self.calls = []

    async def wait_for_timeout(self, ms):
        self.calls.append(ms)


def test_safe_wait_only_for_positive_ms():
    page = FakePage()
    asyncio.run(safe_wait(page, 0))
    asyncio.run(safe_wait(page, -1))
    asyncio.run(safe_wait(page, 123))
    assert page.calls == [123]


def test_swallowed_default_and_specific_exceptions():
    with swallowed():
        raise RuntimeError("x")

    with swallowed(ValueError):
        raise ValueError("x")


def test_retry_async_retries_then_succeeds():
    state = {"n": 0}

    async def flaky():
        state["n"] += 1
        if state["n"] < 2:
            raise RuntimeError("boom")
        return "ok"

    out = asyncio.run(retry_async(flaky, attempts=3, base_delay_ms=0))
    assert out == "ok"
    assert state["n"] == 2


def test_retry_async_raises_last_exception():
    async def always_fail():
        raise ValueError("nope")

    try:
        asyncio.run(retry_async(always_fail, attempts=2, base_delay_ms=0))
        assert False, "expected ValueError"
    except ValueError as exc:
        assert "nope" in str(exc)
