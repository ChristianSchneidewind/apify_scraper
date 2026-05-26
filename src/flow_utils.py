from contextlib import suppress


async def safe_wait(page, ms: int):
    if ms > 0:
        await page.wait_for_timeout(ms)


def swallowed(*exceptions):
    if not exceptions:
        exceptions = (Exception,)
    return suppress(*exceptions)
