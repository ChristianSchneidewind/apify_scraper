import asyncio


async def handle_cookie_banner(page):
    selectors = [
        'button:has-text("Allow all cookies")',
        'button:has-text("Decline optional cookies")',
        'text="Only allow essential cookies"',
        'text="Allow all cookies"',
        'text="Accept all"',
        'text="Accept All"',
        'text="Accept"',
        'button:has-text("Alle Cookies erlauben")',
        'button:has-text("Optionale Cookies ablehnen")',
    ]

    for _ in range(5):
        for selector in selectors:
            locator = page.locator(selector).first
            if await locator.count() > 0:
                try:
                    if await locator.is_visible():
                        await locator.click(timeout=2000)
                        await page.wait_for_timeout(1500)
                        return
                except Exception:
                    pass
        await page.wait_for_timeout(1000)


async def dismiss_login_wall(page):
    await page.evaluate(
        """
        () => {
          if (window.__apifyHideDialog) return;
          window.__apifyHideDialog = true;
          const hideDialogs = () => {
            document.querySelectorAll('div[role="dialog"]').forEach((dialog) => {
              const txt = (dialog.innerText || '').toLowerCase();
              const isLoginWall =
                txt.includes('log in') || txt.includes('login') || txt.includes('anmelden') ||
                txt.includes('sign up') || txt.includes('registrieren') ||
                txt.includes('see more from') || txt.includes('mehr von instagram');
              if (!isLoginWall) return;

              dialog.style.setProperty('display', 'none', 'important');
              dialog.style.setProperty('visibility', 'hidden', 'important');
              dialog.style.setProperty('opacity', '0', 'important');
              const parent = dialog.parentElement;
              if (parent) {
                parent.style.setProperty('display', 'none', 'important');
                parent.style.setProperty('visibility', 'hidden', 'important');
                parent.style.setProperty('opacity', '0', 'important');
              }
            });
            document.body.style.overflow = 'auto';
          };
          hideDialogs();
          setInterval(hideDialogs, 500);
        }
        """
    )


async def ensure_logged_in(page, kv_store, username, password, screenshot_timeout_ms):
    if not username or not password:
        raise RuntimeError("Login enabled but credentials missing.")

    await page.goto("https://www.instagram.com/", wait_until="domcontentloaded")
    await handle_cookie_banner(page)

    logged_in = await page.locator('nav, svg[aria-label="Home"], svg[aria-label="Profile"]').first.count()
    if logged_in:
        return

    await page.goto("https://www.instagram.com/accounts/login/?next=%2Fp%2FDWHWE2vDbdr%2F", wait_until="domcontentloaded")
    await handle_cookie_banner(page)

    login_link = page.locator('a[href^="/accounts/login/"]').first
    if await login_link.count() > 0:
        try:
            await login_link.click(timeout=2000)
            await page.wait_for_timeout(1500)
        except Exception:
            pass

    username_input = page.locator('input[name="username"], input[autocomplete="username"], input[type="text"]').first
    password_input = page.locator('input[name="password"], input[autocomplete="current-password"], input[type="password"]').first

    try:
        await username_input.wait_for(timeout=20000)
    except Exception:
        debug_key = f"login-form-missing-{int(asyncio.get_event_loop().time()*1000)}.png"
        debug_buffer = await page.screenshot(full_page=True, timeout=screenshot_timeout_ms)
        await kv_store.set_value(debug_key, debug_buffer, content_type="image/png")
        html_key = f"login-form-missing-{int(asyncio.get_event_loop().time()*1000)}.html"
        html = await page.content()
        await kv_store.set_value(html_key, html, content_type="text/html")
        raise RuntimeError(f"Login form not found. Saved {debug_key} and {html_key}")

    await username_input.fill(username)
    await password_input.fill(password)
    await password_input.press("Enter")

    await page.wait_for_timeout(3000)
    await page.wait_for_selector('nav, svg[aria-label="Home"], svg[aria-label="Profile"]', timeout=20000)


