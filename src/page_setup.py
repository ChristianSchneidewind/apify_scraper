import asyncio

from .auth import dismiss_login_wall, handle_cookie_banner
from .log_events import warn_event
from .ui import auto_scroll, expand_comments, force_light_mode, get_comment_container, load_all_comments, open_comments_panel


async def prepare_comments_page(*, page, max_ui_rounds: int, ui_idle_rounds: int, load_timeout_secs: int, safe_interaction_mode: bool = False):
    await force_light_mode(page)
    await handle_cookie_banner(page)
    await dismiss_login_wall(page)

    await force_light_mode(page)
    await open_comments_panel(page, safe_mode=safe_interaction_mode)
    await dismiss_login_wall(page)
    if await page.eval_on_selector_all("time", "nodes => nodes.length") == 0:
        await open_comments_panel(page, safe_mode=safe_interaction_mode)

    try:
        await asyncio.wait_for(
            load_all_comments(page, max_ui_rounds, ui_idle_rounds, safe_mode=safe_interaction_mode),
            timeout=load_timeout_secs,
        )
    except Exception as exc:
        warn_event("page_setup.load_all_comments_warning", error_type=type(exc).__name__, error=repr(exc))

    await auto_scroll(page, 8)
    await page.wait_for_timeout(1500)
    await dismiss_login_wall(page)

    await expand_comments(page, 30, safe_mode=safe_interaction_mode)
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
