import asyncio
import hashlib
import json
import os
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path

from apify import Actor
from dotenv import load_dotenv
from crawlee.crawlers import PlaywrightCrawler, PlaywrightCrawlingContext

load_dotenv()

SCREENSHOTS_DIR = Path.cwd() / "Screenshots"
VIEWPORT_WIDTH = 768
VIEWPORT_HEIGHT = 1024

LOAD_MORE_TEXTS = [
    "View more comments",
    "Load more comments",
    "View all comments",
    "View hidden comments",
    "Show hidden comments",
    "Hidden comments",
    "View more",
    "View replies",
    "View reply",
    "View all replies",
    "View more replies",
    "Replies",
    "Weitere Kommentare",
    "Weitere Kommentare ansehen",
    "Alle Kommentare anzeigen",
    "Ausgeblendete Kommentare anzeigen",
    "Ausgeblendete Kommentare",
    "Verborgene Kommentare anzeigen",
    "Antworten ansehen",
    "Weitere Antworten anzeigen",
]


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


async def hide_visual_overlays(page):
    await page.evaluate(
        """
        () => {
          const candidates = Array.from(document.querySelectorAll('[role="banner"], [aria-label="Reels navigation controls"], [aria-label="Navigate to next Reel"], [aria-label="Navigate to previous Reel"], header, nav'));
          for (const el of candidates) {
            const containsHighlight = !!el.querySelector?.('[data-apify-highlight="1"]');
            if (containsHighlight) continue;
            el.style.setProperty('opacity', '0', 'important');
            el.style.setProperty('pointer-events', 'none', 'important');
          }
        }
        """
    )


async def freeze_animated_media(page):
    await page.evaluate(
        """
        () => {
          document.querySelectorAll('video').forEach((v) => {
            try { v.pause(); } catch (e) {}
          });
        }
        """
    )


async def set_screenshot_banner(page, video_url: str, utc_time: str):
    await page.evaluate(
        """
        ({ videoUrl, utcTime }) => {
          const id = 'apify-screenshot-banner';
          let el = document.getElementById(id);
          if (!el) {
            el = document.createElement('div');
            el.id = id;
            document.body.appendChild(el);
          }
          el.textContent = `${videoUrl}\n${utcTime}`;
          el.style.position = 'fixed';
          el.style.left = '12px';
          el.style.bottom = '12px';
          el.style.zIndex = '2147483647';
          el.style.padding = '8px 10px';
          el.style.background = 'rgba(0,0,0,0.75)';
          el.style.color = '#fff';
          el.style.fontSize = '12px';
          el.style.fontFamily = 'monospace';
          el.style.lineHeight = '1.35';
          el.style.whiteSpace = 'pre-line';
          el.style.borderRadius = '6px';
          el.style.maxWidth = '70vw';
          el.style.wordBreak = 'break-all';
          el.style.pointerEvents = 'none';
        }
        """,
        {"videoUrl": video_url, "utcTime": utc_time},
    )


async def force_light_mode(page):
    try:
        await page.emulate_media(color_scheme="light")
    except Exception:
        pass
    await page.add_init_script(
        """
        () => {
          if (window.__apifyForceLightMode) return;
          window.__apifyForceLightMode = true;
          const origMatchMedia = window.matchMedia;
          window.matchMedia = (query) => {
            if (query && query.includes('prefers-color-scheme')) {
              return { matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false };
            }
            return origMatchMedia(query);
          };
          const force = () => {
            try {
              localStorage.setItem('ig_theme', 'light');
              localStorage.setItem('ig-theme', 'light');
              localStorage.setItem('theme', 'light');
              sessionStorage.setItem('ig_theme', 'light');
              document.cookie = 'ig_theme=light; path=/; max-age=31536000';
            } catch (err) {}
            document.documentElement.setAttribute('data-theme', 'light');
            document.body?.setAttribute('data-theme', 'light');
            document.documentElement.classList.forEach((cls) => {
              if (cls.includes('dark')) document.documentElement.classList.remove(cls);
            });
            document.body?.classList?.forEach?.((cls) => {
              if (cls.includes('dark')) document.body.classList.remove(cls);
            });
            document.documentElement.style.setProperty('color-scheme', 'light', 'important');
            document.documentElement.style.setProperty('--ig-primary-background', '#fff', 'important');
            document.documentElement.style.setProperty('--ig-secondary-background', '#fff', 'important');
            document.documentElement.style.setProperty('--ig-elevated-background', '#fff', 'important');
            document.documentElement.style.setProperty('--ig-primary-text', '#000', 'important');
            document.documentElement.style.setProperty('--ig-secondary-text', '#222', 'important');
            document.body?.style?.setProperty('background', '#fff', 'important');
          };
          force();
          const observer = new MutationObserver(force);
          observer.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
          setInterval(force, 1000);
        }
        """
    )
    await page.evaluate(
        """
        () => {
          const styleId = 'apify-force-light-mode';
          let style = document.getElementById(styleId);
          if (!style) {
            style = document.createElement('style');
            style.id = styleId;
            document.head?.appendChild(style);
          }
          style.textContent = `
            :root {
              color-scheme: light !important;
              --ig-primary-background: #fff !important;
              --ig-secondary-background: #fff !important;
              --ig-elevated-background: #fff !important;
              --ig-primary-text: #000 !important;
              --ig-secondary-text: #222 !important;
            }
            html, body, main, section, article { background: #fff !important; color: #000 !important; }
            * { filter: none !important; }
          `;
          document.documentElement.style.setProperty('color-scheme', 'light', 'important');
          document.body?.style?.setProperty('background', '#fff', 'important');
        }
        """
    )


async def open_comments_panel(page):
    # First try a robust in-page click strategy (works for many Reel layouts).
    clicked = await page.evaluate(
        """
        () => {
          const norm = (s) => (s || '').toLowerCase();
          const candidates = Array.from(document.querySelectorAll('button, a, div[role="button"], svg'));
          for (const el of candidates) {
            const label = norm(el.getAttribute('aria-label'));
            const text = norm(el.textContent);
            const href = norm(el.getAttribute('href'));
            const isComment =
              label.includes('comment') || label.includes('kommentar') || label.includes('komment') ||
              text.includes('comment') || text.includes('kommentar') || text.includes('komment') ||
              href.includes('/comments/');
            if (!isComment) continue;

            const clickable = el.closest('button, a, div[role="button"]') || el;
            clickable.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            return true;
          }
          return false;
        }
        """
    )
    if clicked:
        await page.wait_for_timeout(1500)
        return

    selectors = [
        '[aria-label="Comment"]',
        '[aria-label*="Komment"]',
        'svg[aria-label="Comment"]',
        'svg[aria-label*="Komment"]',
        'a[href*="/comments/"]',
        'button:has-text("View comments")',
        'button:has-text("comments")',
        'button:has-text("Kommentare")',
    ]

    for selector in selectors:
        locator = page.locator(selector).first
        if await locator.count() == 0:
            continue
        try:
            await locator.click(timeout=2000)
            await page.wait_for_timeout(1200)
            return
        except Exception:
            pass


async def switch_comments_to_newest(page):
    # Try several times because Instagram sometimes re-renders the comments dialog.
    for _ in range(4):
        try:
            sort_toggle = page.locator(
                'div[role="dialog"] :is(button, a, div[role="button"], span):text-matches("^(Für dich|For you)$", "i")'
            ).first
            if await sort_toggle.count() > 0:
                await sort_toggle.click(timeout=1500)
                await page.wait_for_timeout(400)
        except Exception:
            pass

        # If menu is already open or available directly, click "Newest".
        newest_locators = [
            page.locator('div[role="dialog"] :is(button, a, div[role="button"], span):text-matches("^(Neueste|Newest|Most recent)$", "i")').first,
            page.locator(':is(button, a, div[role="button"], span):text-matches("^(Neueste|Newest|Most recent)$", "i")').first,
        ]

        clicked = False
        for loc in newest_locators:
            try:
                if await loc.count() > 0:
                    await loc.click(timeout=1500)
                    clicked = True
                    break
            except Exception:
                pass

        await page.wait_for_timeout(500)

        # Verify if switched.
        try:
            is_newest_visible = await page.locator(
                'div[role="dialog"] :is(button, a, div[role="button"], span):text-matches("^(Neueste|Newest|Most recent)$", "i")'
            ).count()
            if clicked or is_newest_visible > 0:
                return
        except Exception:
            pass


async def expand_comments(page, max_clicks):
    clicks = 0
    while clicks < max_clicks:
        clicked = await page.evaluate(
            """
            (texts) => {
              let count = 0;
              const candidates = Array.from(document.querySelectorAll('button, [role="button"], a'));
              for (const el of candidates) {
                const text = (el.innerText || '').trim();
                if (!text) continue;
                const lower = text.toLowerCase();
                const isReplyAction = lower === 'reply' || lower === 'antworten';
                const looksLikeReplies = (lower.includes('repl') || lower.includes('antwort')) && /\\d/.test(text);
                const looksLikeView = lower.includes('view') || lower.includes('anzeigen') || lower.includes('ansehen') || lower.includes('more');
                if (isReplyAction) continue;
                if (texts.some((item) => text.includes(item)) || (looksLikeReplies && looksLikeView)) {
                  el.click();
                  count += 1;
                }
              }
              return count;
            }
            """,
            LOAD_MORE_TEXTS,
        )
        if not clicked:
            break
        clicks += clicked
        await page.wait_for_timeout(1200)


async def scroll_comment_container(page, rounds=3):
    for _ in range(rounds):
        scrolled = await page.evaluate(
            """
            () => {
              const isReel = /\\/reels?\\//.test(location.pathname);

              const dialogCandidates = Array.from(document.querySelectorAll('div[role="dialog"] div, div[role="dialog"] ul, div[role="dialog"] section'))
                .filter((el) => el.querySelectorAll('time').length > 0)
                .filter((el) => el.scrollHeight - el.clientHeight > 40);

              const genericCandidates = Array.from(document.querySelectorAll('div, ul, section'))
                .filter((el) => el.querySelectorAll('time').length > 1)
                .filter((el) => el.scrollHeight - el.clientHeight > 80);

              const candidates = dialogCandidates.length ? dialogCandidates : genericCandidates;
              if (!candidates.length) return 0;

              candidates.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight));
              const target = candidates[0];
              const before = target.scrollTop;
              target.scrollTop += Math.max(400, target.clientHeight * 0.85);
              const moved = Math.abs(target.scrollTop - before);

              if (!moved && isReel) return 0;
              return moved;
            }
            """
        )
        if not scrolled:
            break
        await page.wait_for_timeout(1200)


async def auto_scroll(page, rounds):
    for _ in range(rounds):
        scrolled = await page.evaluate(
            """
            () => {
              const isReel = /\\/reels?\\//.test(location.pathname);

              const dialogWithTimes = Array.from(document.querySelectorAll('div[role="dialog"] ul, div[role="dialog"] section, div[role="dialog"] div'))
                .filter((el) => el.querySelectorAll('time').length > 0)
                .filter((el) => el.scrollHeight - el.clientHeight > 40);

              const withTimes = (dialogWithTimes.length ? dialogWithTimes : Array.from(document.querySelectorAll('ul, section, div')))
                .filter((el) => el.querySelectorAll('time').length > 1)
                .filter((el) => el.scrollHeight - el.clientHeight > 50);

              if (withTimes.length) {
                withTimes.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight));
                const target = withTimes[0];
                const before = target.scrollTop;
                target.scrollTop += Math.max(400, target.clientHeight * 0.8);
                return Math.abs(target.scrollTop - before) > 10;
              }

              if (isReel) return false;

              const before = window.scrollY;
              window.scrollBy(0, 1200);
              return Math.abs(window.scrollY - before) > 10;
            }
            """
        )
        if not scrolled:
            break
        await page.wait_for_timeout(1000)


async def load_all_comments(page, max_rounds, idle_rounds):
    rounds = 0
    idle = 0
    last_count = 0

    while rounds < max_rounds and idle < idle_rounds:
        current_count = await page.eval_on_selector_all("time", "nodes => nodes.length")
        if current_count == 0:
            await open_comments_panel(page)
            await dismiss_login_wall(page)

        await expand_comments(page, 20)
        await scroll_comment_container(page, 5)
        await auto_scroll(page, 4)
        await page.wait_for_timeout(1500)

        current_count = await page.eval_on_selector_all("time", "nodes => nodes.length")
        if current_count > last_count:
            last_count = current_count
            idle = 0
        else:
            idle += 1
        rounds += 1


async def extract_comment_from_time(time_handle):
    result = await time_handle.evaluate(
        r"""
        (timeEl) => {
          const ignoreTexts = new Set(['Like', 'Reply', 'Log in', 'Sign up', 'Comment', 'Share', 'Save']);
          const timeText = timeEl.textContent?.trim() ?? null;
          const isValidUsername = (username) => /^[a-zA-Z0-9._]{2,30}$/.test(username || '');

          let current = timeEl.parentElement;
          for (let i = 0; i < 10 && current; i += 1) {
            const links = Array.from(current.querySelectorAll('a[role="link"], a'));
            const usernameLink = links.find((a) => {
              const href = a.getAttribute('href') ?? '';
              return href.startsWith('/') && !href.includes('/p/') && !href.includes('/accounts/');
            });

            if (usernameLink) {
              const spans = Array.from(current.querySelectorAll('span'))
                .map((span) => span.textContent?.trim())
                .filter((text) => text && !ignoreTexts.has(text));

              const username = usernameLink.textContent?.trim();
              if (!isValidUsername(username)) {
                current = current.parentElement;
                continue;
              }

              const text = spans
                .filter((textItem) => textItem !== username && textItem !== timeText)
                .sort((a, b) => b.length - a.length)[0];

              const hasGif = Array.from(current.querySelectorAll('img, video, canvas')).some((node) => {
                const src = (node.getAttribute?.('src') || node.getAttribute?.('poster') || '').toLowerCase();
                const alt = (node.getAttribute?.('alt') || '').toLowerCase();
                const aria = (node.getAttribute?.('aria-label') || '').toLowerCase();
                const cls = String(node.getAttribute?.('class') || '').toLowerCase();
                const r = node.getBoundingClientRect?.() || { width: 0, height: 0 };
                if (alt.includes('profile picture') || alt.includes('profilbild') || cls.includes('avatar')) return false;
                if (r.width <= 40 && r.height <= 40) return false;
                return src.includes('giphy') || src.includes('.gif') || src.includes('/gif') || alt.includes('gif') || aria.includes('gif') || alt.includes('sticker') || aria.includes('sticker') || r.width >= 48 || r.height >= 48;
              });

              const raw = (current.innerText || '').replace(/\s+/g, ' ').trim();
              const cleaned = raw
                .replace(new RegExp(username?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') || '', 'ig'), '')
                .replace(new RegExp((timeText || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '')
                .replace(/\b(Like|Reply|Replies|Log in|Sign up|Comment|Share|Save|GIF|Sticker|Gefällt|Antworten|Antwort|Ansehen|anzeigen|weiter|more|view|replies)\b/ig, '')
                .replace(/[^\p{L}\p{N}]+/gu, ' ')
                .replace(/\b\d+[.,]?\d*\b/g, '')
                .replace(/\s+/g, ' ')
                .trim();

              if (username && text && text.length >= 1) {
                return {
                  username,
                  text,
                  datetime: timeEl.getAttribute('datetime') ?? null,
                  timeText,
                  isGifOnly: false,
                };
              }

              if (username && hasGif && cleaned.length === 0) {
                return {
                  username,
                  text: '[GIF]',
                  datetime: timeEl.getAttribute('datetime') ?? null,
                  timeText,
                  isGifOnly: true,
                };
              }
            }

            current = current.parentElement;
          }

          return null;
        }
        """
    )

    if not result:
        return None, None

    element_handle = await time_handle.evaluate_handle(
        """
        (timeEl) => {
          const strict = timeEl.closest('li, [role="listitem"], article');
          if (strict) return strict;

          let current = timeEl.parentElement;
          while (current) {
            const txt = (current.innerText || '').trim();
            if (txt.length > 30) return current;
            current = current.parentElement;
          }

          return timeEl.parentElement || timeEl;
        }
        """
    )

    return result, element_handle


async def extract_comment_from_item(item_handle):
    result = await item_handle.evaluate(
        r"""
        (item) => {
          const ignoreTexts = new Set(['Like', 'Reply', 'Log in', 'Sign up', 'Comment', 'Share', 'Save']);
          const isValidUsername = (username) => /^[a-zA-Z0-9._]{2,30}$/.test(username || '');

          const links = Array.from(item.querySelectorAll('a[role="link"], a'));
          const usernameLink = links.find((a) => {
            const href = a.getAttribute('href') ?? '';
            return href.startsWith('/') && !href.includes('/p/') && !href.includes('/accounts/');
          });
          const username = usernameLink?.textContent?.trim() || null;
          if (!isValidUsername(username)) return null;

          const timeEl = item.querySelector('time');
          const timeText = timeEl?.textContent?.trim() ?? null;
          const datetime = timeEl?.getAttribute('datetime') ?? null;

          const spans = Array.from(item.querySelectorAll('span'))
            .map((s) => s.textContent?.trim())
            .filter((t) => t && !ignoreTexts.has(t));

          const textCandidates = spans
            .filter((t) => t !== username && t !== timeText)
            .sort((a, b) => b.length - a.length);

          const text = textCandidates[0] || null;
          const hasGif = Array.from(item.querySelectorAll('img, video, canvas')).some((node) => {
            const src = (node.getAttribute?.('src') || node.getAttribute?.('poster') || '').toLowerCase();
            const alt = (node.getAttribute?.('alt') || '').toLowerCase();
            const aria = (node.getAttribute?.('aria-label') || '').toLowerCase();
            const cls = String(node.getAttribute?.('class') || '').toLowerCase();
            const r = node.getBoundingClientRect?.() || { width: 0, height: 0 };
            if (alt.includes('profile picture') || alt.includes('profilbild') || cls.includes('avatar')) return false;
            if (r.width <= 40 && r.height <= 40) return false;
            return src.includes('giphy') || src.includes('.gif') || src.includes('/gif') || alt.includes('gif') || aria.includes('gif') || alt.includes('sticker') || aria.includes('sticker') || r.width >= 48 || r.height >= 48;
          });

          const raw = (item.innerText || '').replace(/\s+/g, ' ').trim();
          const cleaned = raw
            .replace(new RegExp(username?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') || '', 'ig'), '')
            .replace(new RegExp((timeText || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '')
            .replace(/\b(Like|Reply|Replies|Log in|Sign up|Comment|Share|Save|GIF|Sticker|Gefällt|Antworten|Antwort|Ansehen|anzeigen|weiter|more|view|replies)\b/ig, '')
            .replace(/[^\p{L}\p{N}]+/gu, ' ')
            .replace(/\b\d+[.,]?\d*\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();

          if (text && text.length >= 1) {
            return { username, text, datetime, timeText, isGifOnly: false };
          }
          if (hasGif && cleaned.length === 0) {
            return { username, text: '[GIF]', datetime, timeText, isGifOnly: true };
          }
          return null;
        }
        """
    )

    if not result:
        return None, None

    return result, item_handle


async def get_dialog_comment_rows(page):
    return await page.query_selector_all(
        'div[role="dialog"] li, '
        'div[role="dialog"] [role="listitem"], '
        'div[role="dialog"] article, '
        'div[role="dialog"] div:has(a[href^="/"]):has(img, video, canvas)'
    )


async def highlight(page, element_handle, comment_data):
    if not element_handle:
        return False

    ok = await page.evaluate(
        """
        (payload) => {
          const { el, username, text, isGifOnly } = payload;
          document.querySelectorAll('[data-apify-highlight="1"]').forEach((prev) => {
            prev.style.outline = '';
            prev.style.outlineOffset = '';
            prev.style.boxShadow = '';
            prev.removeAttribute('data-apify-highlight');
          });

          const fullText = (text || '').toLowerCase();
          const user = (username || '').toLowerCase();
          const hasGif = (root) => Array.from(root?.querySelectorAll?.('img, video, canvas') || []).some((node) => {
            const src = (node.getAttribute?.('src') || node.getAttribute?.('poster') || '').toLowerCase();
            const alt = (node.getAttribute?.('alt') || '').toLowerCase();
            const aria = (node.getAttribute?.('aria-label') || '').toLowerCase();
            const cls = String(node.getAttribute?.('class') || '').toLowerCase();
            const r = node.getBoundingClientRect?.() || { width: 0, height: 0 };
            if (alt.includes('profile picture') || alt.includes('profilbild') || cls.includes('avatar')) return false;
            if (r.width <= 40 && r.height <= 40) return false;
            return src.includes('giphy') || src.includes('.gif') || src.includes('/gif') || alt.includes('gif') || aria.includes('gif') || alt.includes('sticker') || aria.includes('sticker') || r.width >= 48 || r.height >= 48;
          });

          const matchesRow = (node) => {
            const content = (node.innerText || '').toLowerCase();
            const hasUser = user && content.includes(user);
            const hasText = !isGifOnly && fullText && content.includes(fullText);
            return isGifOnly ? (hasUser && hasGif(node)) : (hasUser && hasText);
          };

          const hasAvatar = (node) => {
            if (!node) return false;
            return !!node.querySelector('img[alt*="profile" i], img[alt*="profil" i], img[class*="avatar" i], a[href^="/"] img');
          };

          // 1) Prefer nearest explicit row container (usually includes avatar + text).
          let row = el?.closest?.('li, [role="listitem"], article') || el;

          // 2) Expand to a better ancestor that still looks like a single comment row.
          let current = row;
          for (let i = 0; i < 6 && current; i += 1) {
            const r = current.getBoundingClientRect();
            if (matchesRow(current) && hasAvatar(current) && r.width >= 160 && r.height >= 24 && r.height <= 420) {
              row = current;
            }
            current = current.parentElement;
          }

          // 3) Fallback: if we still don't match, find closest valid ancestor.
          if (!matchesRow(row)) {
            current = el;
            for (let i = 0; i < 8 && current; i += 1) {
              const r = current.getBoundingClientRect();
              if (matchesRow(current) && r.width >= 160 && r.height >= 24 && r.height <= 420) {
                row = current;
                break;
              }
              current = current.parentElement;
            }
          }

          const finalTarget = row || el;
          const rect = finalTarget.getBoundingClientRect();
          const validSize = rect.width >= 160 && rect.height >= 24 && rect.height <= 420;
          if (!validSize) return false;

          finalTarget.setAttribute('data-apify-highlight', '1');
          finalTarget.style.outline = '3px solid red';
          finalTarget.style.outlineOffset = '2px';
          finalTarget.style.boxShadow = '0 0 0 3px red inset';
          finalTarget.style.backgroundClip = 'padding-box';
          return true;
        }
        """,
        {
            "el": element_handle,
            "username": comment_data.get("username"),
            "text": comment_data.get("text"),
            "isGifOnly": bool(comment_data.get("isGifOnly")),
        },
    )
    return bool(ok)


def make_key(url, index):
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", re.sub(r"^https?://", "", url)).strip("-").lower()
    return f"comment-{slug}-{index}.png"


async def save_screenshot(buffer, filename):
    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    file_path = SCREENSHOTS_DIR / filename
    file_path.write_bytes(buffer)
    return str(file_path)


async def dump_skip_debug(page, kv_store, index, data, screenshot_timeout_ms):
    prefix = f"debug-skip-{index}"

    try:
        buffer = await page.screenshot(full_page=False, timeout=screenshot_timeout_ms)
        await kv_store.set_value(f"{prefix}.png", buffer, content_type="image/png")
    except Exception:
        pass

    try:
        html = await page.content()
        await kv_store.set_value(f"{prefix}.html", html, content_type="text/html")
    except Exception:
        pass

    try:
        dom_info = await page.evaluate(
            r"""
            () => {
              const candidates = Array.from(document.querySelectorAll('div[role="dialog"] *'));
              const rows = candidates
                .filter((el) => {
                  const txt = (el.innerText || '').trim();
                  const hasTime = !!el.querySelector?.('time');
                  const hasGif = !!el.querySelector?.('img[alt*="GIF" i], img[src*="gif" i], [aria-label*="GIF" i]');
                  const r = el.getBoundingClientRect();
                  return (hasTime || hasGif || txt.length > 0) && r.width > 120 && r.height > 20;
                })
                .slice(0, 300);

              return rows.map((row, i) => {
                const r = row.getBoundingClientRect();
                const text = (row.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 220);
                const hasGif = !!row.querySelector('img[alt*="GIF" i], img[src*="gif" i], [aria-label*="GIF" i]');
                const hasTime = !!row.querySelector('time');
                return {
                  i,
                  tag: row.tagName,
                  text,
                  hasGif,
                  hasTime,
                  rect: { x: r.x, y: r.y, w: r.width, h: r.height },
                };
              });
            }
            """
        )
        payload = {
            "index": index,
            "candidate": data,
            "url": page.url,
            "rows": dom_info,
        }
        await kv_store.set_value(f"{prefix}.json", json.dumps(payload, indent=2), content_type="application/json")
    except Exception:
        pass


async def get_comment_container(page):
    return await page.evaluate_handle(
        """
        () => {
          const candidates = Array.from(document.querySelectorAll('ul, section, div'))
            .filter((el) => el.querySelectorAll('time').length > 2)
            .filter((el) => (el.scrollHeight - el.clientHeight) > 50);
          if (!candidates.length) return null;
          candidates.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight));
          return candidates[0];
        }
        """
    )


async def scroll_to_element(page, element_handle, container_handle=None):
    if not element_handle:
        return

    try:
        await element_handle.scroll_into_view_if_needed(timeout=5000)
    except Exception:
        pass

    await page.evaluate(
        """
        (el) => {
          if (!el) return;
          const scrollParent = (() => {
            let current = el.parentElement;
            while (current) {
              if (current.scrollHeight - current.clientHeight > 20) return current;
              current = current.parentElement;
            }
            return null;
          })();

          if (scrollParent) {
            const rect = el.getBoundingClientRect();
            const parentRect = scrollParent.getBoundingClientRect();
            const offset = rect.top - parentRect.top;
            scrollParent.scrollTop += offset - (scrollParent.clientHeight / 2);
          }

          el.scrollIntoView({ block: 'center', inline: 'nearest' });
          window.scrollBy(0, -120);
        }
        """,
        element_handle,
    )


async def main():
    async with Actor:
        input_data = await Actor.get_input() or {}
        urls = input_data.get("urls", [])
        if not urls:
            raise RuntimeError('Input "urls" must be a non-empty array of Instagram post URLs.')

        max_comments = input_data.get("maxComments") or 0
        max_ui_rounds = input_data.get("maxUiRounds", 120)
        ui_idle_rounds = input_data.get("uiIdleRounds", 15)
        load_timeout_secs = input_data.get("loadTimeoutSecs", 180)
        screenshot_timeout_ms = int(input_data.get("screenshotTimeoutSecs", 60) * 1000)
        request_handler_timeout_secs = int(input_data.get("requestHandlerTimeoutSecs", 900))
        login_enabled = input_data.get("loginEnabled", False)
        login_username = input_data.get("loginUsername") or os.getenv("INSTAGRAM_USERNAME")
        login_password = input_data.get("loginPassword") or os.getenv("INSTAGRAM_PASSWORD")
        login_state_key = input_data.get("loginStateKey", "LOGIN_STATE")
        save_login_state = input_data.get("saveLoginState", True)
        headful = input_data.get("headful", False)
        slow_mo_ms = int(input_data.get("slowMoMs", 0))
        debug_network = bool(input_data.get("debugNetwork", False))
        debug_har = bool(input_data.get("debugHar", False))
        debug_devtools = bool(input_data.get("debugDevtools", False))
        manual_debug_mode = bool(input_data.get("manualDebugMode", False))
        manual_debug_only = bool(input_data.get("manualDebugOnly", False))
        manual_debug_pause_secs = int(input_data.get("manualDebugPauseSecs", 180))

        dataset = await Actor.open_dataset()
        kv_store = await Actor.open_key_value_store()

        SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
        for file in SCREENSHOTS_DIR.glob("*.png"):
            file.unlink(missing_ok=True)

        dataset_dir = Path.cwd() / "storage" / "datasets" / "default"
        if dataset_dir.exists():
            for file in dataset_dir.glob("*.json"):
                file.unlink(missing_ok=True)

        stored_state = await kv_store.get_value(login_state_key) if login_enabled else None
        browser_new_context_options = {
            "color_scheme": "light",
            "viewport": {"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT},
            "screen": {"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT},
        }
        if debug_har:
            browser_new_context_options["record_har_path"] = str(Path.cwd() / "storage" / "instagram-debug.har")
            browser_new_context_options["record_har_content"] = "embed"
            browser_new_context_options["record_har_mode"] = "full"

        crawler = PlaywrightCrawler(
            max_requests_per_crawl=len(urls),
            max_request_retries=0,
            headless=not headful,
            browser_type="chromium",
            browser_launch_options={
                "chromium_sandbox": False,
                "args": ["--no-sandbox", f"--window-size={VIEWPORT_WIDTH},{VIEWPORT_HEIGHT}"],
                "slow_mo": slow_mo_ms,
                "devtools": bool(debug_devtools),
            },
            browser_new_context_options=browser_new_context_options,
            request_handler_timeout=timedelta(seconds=request_handler_timeout_secs),
        )

        login_done = False
        cookies_loaded = False
        stored_state_data = stored_state

        @crawler.router.default_handler
        async def request_handler(context: PlaywrightCrawlingContext) -> None:
            nonlocal login_done
            page = context.page

            if debug_network:
                def _short(s, n=300):
                    return (s[:n] + "…") if s and len(s) > n else s

                saved_comment_responses = {"count": 0}
                comment_query_names = {
                    "PolarisPostCommentsContainerQuery",
                    "PolarisClipsDesktopCommentsPopoverQuery",
                    "PolarisPostCommentsPaginationQuery",
                    "PolarisPostChildCommentsQuery",
                }
                comment_doc_ids = {
                    "26113520058347588",
                    "26591948213770017",
                    "25516980651312394",
                    "34884685271179117",
                    "17953756669066153",
                }

                async def on_request(request):
                    try:
                        url = request.url
                        post_data = request.post_data or ""
                        has_comment_hint = (
                            "comment" in url.lower()
                            or "comment" in post_data.lower()
                            or any(name in post_data for name in comment_query_names)
                            or any(doc in post_data for doc in comment_doc_ids)
                            or any(doc in url for doc in comment_doc_ids)
                        )
                        if not has_comment_hint:
                            return
                        saved_comment_responses["count"] += 1
                        idx = saved_comment_responses["count"]
                        key = f"debug-comments-req-{idx:03d}.json"
                        payload = {
                            "index": idx,
                            "url": url,
                            "method": request.method,
                            "postData": post_data,
                        }
                        await kv_store.set_value(key, json.dumps(payload, indent=2), content_type="application/json")
                        Actor.log.info(f"[COMMENTS-DEBUG] saved {key}")
                    except Exception as exc:
                        Actor.log.warning(f"[COMMENTS-DEBUG] request save failed: {exc}")

                async def on_response(response):
                    url = response.url
                    body = None
                    if "instagram.com/api" in url or "/graphql/" in url or "comments" in url:
                        try:
                            body = await response.text()
                        except Exception:
                            body = "<no body>"
                        Actor.log.info(f"[RESP] {response.status} {url} body={_short(body)}")

                    try:
                        req = response.request
                        post_data = req.post_data or ""
                        is_comment_query = (
                            "comment" in url.lower()
                            or "comment" in post_data.lower()
                            or any(name in post_data for name in comment_query_names)
                            or any(doc in post_data for doc in comment_doc_ids)
                            or any(doc in url for doc in comment_doc_ids)
                        )
                        if not is_comment_query:
                            return

                        saved_comment_responses["count"] += 1
                        idx = saved_comment_responses["count"]
                        if body is None:
                            try:
                                body = await response.text()
                            except Exception:
                                body = "<no body>"
                        payload = {
                            "index": idx,
                            "status": response.status,
                            "url": url,
                            "method": req.method,
                            "postData": post_data,
                            "body": body if isinstance(body, str) else "<non-text body>",
                        }
                        key = f"debug-comments-resp-{idx:03d}.json"
                        await kv_store.set_value(key, json.dumps(payload, indent=2), content_type="application/json")
                        Actor.log.info(f"[COMMENTS-DEBUG] saved {key}")
                    except Exception as exc:
                        Actor.log.warning(f"[COMMENTS-DEBUG] response save failed: {exc}")

                page.on("request", lambda r: asyncio.create_task(on_request(r)))
                page.on("response", lambda r: asyncio.create_task(on_response(r)))

            nonlocal cookies_loaded, stored_state_data

            if stored_state_data and not cookies_loaded:
                cookies = stored_state_data.get("cookies", [])
                if cookies:
                    await page.context.add_cookies(cookies)
                cookies_loaded = True

            if login_enabled and not login_done:
                browser_context = page.context
                login_page = await browser_context.new_page()
                await ensure_logged_in(login_page, kv_store, login_username, login_password, screenshot_timeout_ms)
                if save_login_state:
                    storage_state = await browser_context.storage_state()
                    await kv_store.set_value(login_state_key, storage_state, content_type="application/json")
                    stored_state_data = storage_state
                await login_page.close()
                login_done = True

            await force_light_mode(page)
            target_url = context.request.url.replace('/reels/', '/reel/')
            await page.goto(target_url, wait_until="domcontentloaded")

            if manual_debug_mode:
                Actor.log.info(
                    f"Manual debug mode active: {manual_debug_pause_secs}s control for user on {target_url}"
                )
                await page.wait_for_timeout(manual_debug_pause_secs * 1000)
                if manual_debug_only:
                    Actor.log.info("Manual debug only active: skipping scraper after pause.")
                    return

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
                Actor.log.warning(f"load_all_comments timeout or error: {exc}")
            await auto_scroll(page, 4)
            await page.wait_for_timeout(1500)
            await dismiss_login_wall(page)

            await expand_comments(page, 30)
            comment_container = await get_comment_container(page)

            # Start screenshotting from the top-most visible comments.
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

            count = 0
            seen_strict = set()
            seen_loose = set()
            seen_visual = set()
            seen_comment_uid = set()
            idle = 0
            last_screenshot_hash = None

            for round_idx in range(max_ui_rounds):
                await expand_comments(page, 12)
                row_handles = await get_dialog_comment_rows(page)
                time_handles = await page.query_selector_all('div[role="dialog"] time, article time, li time, time')
                Actor.log.info(f"Round {round_idx + 1}: {len(row_handles)} comment rows, {len(time_handles)} time nodes")

                new_in_round = 0

                async def process_candidate(data, element_handle):
                    nonlocal count, new_in_round, last_screenshot_hash
                    if not data or not element_handle:
                        return False

                    username = (data.get('username') or '').strip().lower()
                    text = (data.get('text') or '').strip().lower()
                    dt = (data.get('datetime') or '').strip().lower()
                    tt = (data.get('timeText') or '').strip().lower()
                    is_gif = bool(data.get('isGifOnly'))

                    strict_key = f"{username}|{text}|{dt}"
                    if is_gif:
                        loose_key = f"gif|{username}|{tt or dt}"
                    else:
                        loose_key = f"txt|{username}|{text}|{tt or dt}"

                    if strict_key in seen_strict or loose_key in seen_loose:
                        return False

                    comment_uid = await page.evaluate(
                        """
                        (el) => {
                          const row = el?.closest?.('li, [role="listitem"], article') || el;
                          if (!row) return null;
                          const profileHref = row.querySelector('a[href^="/"]')?.getAttribute('href') || '';
                          const timeEl = row.querySelector('time');
                          const dt = timeEl?.getAttribute('datetime') || '';
                          const tt = (timeEl?.textContent || '').trim().toLowerCase();
                          const txt = (row.innerText || '').replace(/\\s+/g, ' ').trim().toLowerCase();
                          const txtSig = txt.slice(0, 120);
                          const mediaSig = Array.from(row.querySelectorAll('img,video,canvas'))
                            .map((n) => (n.getAttribute?.('src') || n.getAttribute?.('poster') || n.getAttribute?.('alt') || n.tagName || '').toLowerCase())
                            .filter(Boolean)
                            .slice(0, 2)
                            .join('|');
                          return `${profileHref}|${dt || tt}|${txtSig}|${mediaSig}`;
                        }
                        """,
                        element_handle,
                    )
                    if comment_uid and comment_uid in seen_comment_uid:
                        return False

                    visual_key = await page.evaluate(
                        """
                        (el) => {
                          const row = el?.closest?.('li, [role="listitem"], article') || el;
                          if (!row) return null;
                          const r = row.getBoundingClientRect();
                          const txt = (row.innerText || '').replace(/\\s+/g, ' ').trim().toLowerCase().slice(0, 220);
                          const t = row.querySelector('time')?.getAttribute('datetime') || row.querySelector('time')?.textContent || '';
                          return `${Math.round(r.top)}|${Math.round(r.height)}|${t}|${txt}`;
                        }
                        """,
                        element_handle,
                    )
                    if visual_key and visual_key in seen_visual:
                        return False

                    seen_strict.add(strict_key)
                    seen_loose.add(loose_key)
                    if comment_uid:
                        seen_comment_uid.add(comment_uid)
                    if visual_key:
                        seen_visual.add(visual_key)

                    count += 1
                    new_in_round += 1
                    if data.get("isGifOnly"):
                        Actor.log.info(f"GIF-only comment detected: {data.get('username')} #{count}")
                    await expand_comments(page, 4)
                    try:
                        await scroll_to_element(page, element_handle, comment_container)
                    except Exception:
                        pass
                    await page.wait_for_timeout(350)

                    await force_light_mode(page)
                    await hide_visual_overlays(page)
                    await highlight(page, element_handle, data)
                    await freeze_animated_media(page)

                    screenshot_key = make_key(context.request.url, count)
                    Actor.log.info(f"Taking screenshot {count} for {context.request.url}")
                    screenshot_path = None
                    try:
                        screenshot_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
                        await set_screenshot_banner(page, page.url, screenshot_utc)
                        buffer = await page.screenshot(full_page=True, timeout=screenshot_timeout_ms)
                        current_hash = hashlib.sha256(buffer).hexdigest()
                        if current_hash == last_screenshot_hash:
                            Actor.log.warning(f"Duplicate screenshot detected for comment {count}; skipping image save.")
                        else:
                            await kv_store.set_value(screenshot_key, buffer, content_type="image/png")
                            screenshot_path = await save_screenshot(buffer, screenshot_key)
                            last_screenshot_hash = current_hash
                    except Exception as exc:
                        Actor.log.warning(f"Screenshot failed for comment {count}: {exc}")
                        await dump_skip_debug(page, kv_store, count, data, screenshot_timeout_ms)

                    await dataset.push_data(
                        {
                            "username": data["username"],
                            "text": data["text"],
                            "isGifOnly": bool(data.get("isGifOnly")),
                            "datetime": data.get("datetime"),
                            "timeText": data.get("timeText"),
                            "index": count,
                            "sourceUrl": context.request.url,
                            "screenshotKey": screenshot_key if screenshot_path else None,
                            "screenshotPath": screenshot_path,
                        }
                    )
                    return True

                for row_handle in row_handles:
                    data, element_handle = await extract_comment_from_item(row_handle)
                    await process_candidate(data, element_handle)
                    if max_comments and count >= max_comments:
                        break

                if (not max_comments or count < max_comments) and new_in_round == 0:
                    for time_handle in time_handles:
                        data, element_handle = await extract_comment_from_time(time_handle)
                        await process_candidate(data, element_handle)
                        if max_comments and count >= max_comments:
                            break

                if max_comments and count >= max_comments:
                    break

                if new_in_round == 0:
                    idle += 1
                else:
                    idle = 0

                if idle >= ui_idle_rounds:
                    break

                scrolled = await page.evaluate(
                    """
                    (container) => {
                      if (!container) {
                        const isReel = /\\/reels?\\//.test(location.pathname);
                        if (isReel) return false;
                        const before = window.scrollY;
                        window.scrollBy(0, window.innerHeight * 0.8);
                        return Math.abs(window.scrollY - before) > 10;
                      }
                      const before = container.scrollTop;
                      container.scrollTop += container.clientHeight * 0.8;
                      return Math.abs(container.scrollTop - before) > 10;
                    }
                    """,
                    comment_container,
                )

                if not scrolled:
                    idle += 1

                await page.wait_for_timeout(1200)

            if count == 0:
                debug_key = f"debug-{int(asyncio.get_event_loop().time()*1000)}.png"
                debug_buffer = await page.screenshot(full_page=True, timeout=screenshot_timeout_ms)
                await kv_store.set_value(debug_key, debug_buffer, content_type="image/png")
                html_key = f"debug-{int(asyncio.get_event_loop().time()*1000)}.html"
                html = await page.content()
                await kv_store.set_value(html_key, html, content_type="text/html")

                time_samples = await page.eval_on_selector_all("time", "nodes => nodes.slice(0, 5).map(node => node.outerHTML)")
                container_samples = await page.eval_on_selector_all(
                    "time",
                    """
                    nodes => nodes.slice(0, 3).map(node => {
                      let current = node.parentElement;
                      const results = [];
                      for (let i = 0; i < 4 && current; i += 1) {
                        results.push(current.outerHTML.slice(0, 800));
                        current = current.parentElement;
                      }
                      return { time: node.outerHTML, ancestors: results };
                    })
                    """,
                )
                sample_key = f"debug-{int(asyncio.get_event_loop().time()*1000)}.json"
                await kv_store.set_value(sample_key, json.dumps({"timeSamples": time_samples, "containerSamples": container_samples}, indent=2), content_type="application/json")

                Actor.log.warning(
                    f"No comments found. Saved debug screenshot {debug_key}, HTML {html_key}, samples {sample_key}"
                )

            Actor.log.info(f"Captured {count} comments for {context.request.url}")

        try:
            await crawler.run(urls)
        except Exception as exc:
            message = str(exc)
            if "Target page, context or browser has been closed" in message:
                Actor.log.warning(f"Crawler shutdown warning ignored: {message}")
            else:
                raise


if __name__ == "__main__":
    asyncio.run(main())
