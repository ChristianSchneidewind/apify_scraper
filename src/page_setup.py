import asyncio

from apify import Actor

from .auth import dismiss_login_wall, handle_cookie_banner
from .ui import auto_scroll, expand_comments, force_light_mode, get_comment_container, load_all_comments, open_comments_panel


async def prepare_comments_page(*, page, max_ui_rounds: int, ui_idle_rounds: int, load_timeout_secs: int):
    await force_light_mode(page)
    await handle_cookie_banner(page)
    await dismiss_login_wall(page)

    await force_light_mode(page)
    await open_comments_panel(page)
    await dismiss_login_wall(page)
    if await page.eval_on_selector_all("time", "nodes => nodes.length") == 0:
        await open_comments_panel(page)

    try:
        await asyncio.wait_for(
            load_all_comments(page, max_ui_rounds, ui_idle_rounds),
            timeout=load_timeout_secs,
        )
    except Exception as exc:
        Actor.log.warning(
            f"load_all_comments timeout or error: {type(exc).__name__}: {exc!r}"
        )

    await auto_scroll(page, 8)
    await page.wait_for_timeout(1500)
    await dismiss_login_wall(page)

    await expand_comments(page, 30)
    comment_container = await get_comment_container(page)

    try:
        await page.evaluate(
            """
            (container) => {
              if (container) container.scrollTop = 0;
              window.scrollTo(0, 0);
            }
            """,
            comment_container,
        )
        await page.wait_for_timeout(500)
    except Exception:
        pass
