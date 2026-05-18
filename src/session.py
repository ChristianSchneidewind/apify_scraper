from src.auth import ensure_logged_in


def init_session_state(stored_state):
    return {
        "login_done": False,
        "cookies_loaded": False,
        "stored_state_data": stored_state,
    }


async def apply_login_session(
    *,
    page,
    kv_store,
    session_state: dict,
    login_enabled: bool,
    login_username: str | None,
    login_password: str | None,
    login_state_key: str,
    save_login_state: bool,
    screenshot_timeout_ms: int,
):
    if session_state.get("stored_state_data") and not session_state.get("cookies_loaded"):
        cookies = session_state["stored_state_data"].get("cookies", [])
        if cookies:
            await page.context.add_cookies(cookies)
        session_state["cookies_loaded"] = True

    if login_enabled and not session_state.get("login_done"):
        browser_context = page.context
        login_page = await browser_context.new_page()
        await ensure_logged_in(login_page, kv_store, login_username, login_password, screenshot_timeout_ms)
        if save_login_state:
            storage_state = await browser_context.storage_state()
            await kv_store.set_value(login_state_key, storage_state, content_type="application/json")
            session_state["stored_state_data"] = storage_state
        await login_page.close()
        session_state["login_done"] = True
