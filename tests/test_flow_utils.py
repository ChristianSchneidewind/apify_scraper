import asyncio

from src.flow_utils import safe_wait, swallowed


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
