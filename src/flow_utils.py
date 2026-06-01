import asyncio
from contextlib import suppress


async def safe_wait(page, ms: int):
    if ms > 0:
        await page.wait_for_timeout(ms)


async def retry_async(fn, *, attempts: int = 3, base_delay_ms: int = 0, backoff: float = 1.0):
    last_exc = None
    delay_s = max(0, int(base_delay_ms)) / 1000

    for i in range(max(1, attempts)):
        try:
            return await fn()
        except Exception as exc:
            last_exc = exc
            if i >= attempts - 1:
                break
            if delay_s > 0:
                await asyncio.sleep(delay_s)
                delay_s *= max(1.0, float(backoff))

    raise last_exc


def swallowed(*exceptions):
    if not exceptions:
        exceptions = (Exception,)
    return suppress(*exceptions)
