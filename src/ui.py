from .auth import dismiss_login_wall
from .constants import LOAD_MORE_TEXTS


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
          el.style.display = 'block';
          el.style.position = 'relative';
          el.style.left = '0';
          el.style.bottom = '0';
          el.style.zIndex = '1';
          el.style.width = '100%';
          el.style.boxSizing = 'border-box';
          el.style.margin = '0';
          el.style.marginTop = '8px';
          el.style.padding = '10px 12px';
          el.style.background = 'rgba(0,0,0,0.92)';
          el.style.color = '#fff';
          el.style.fontSize = '12px';
          el.style.fontFamily = 'monospace';
          el.style.lineHeight = '1.35';
          el.style.whiteSpace = 'pre-line';
          el.style.borderRadius = '0';
          el.style.maxWidth = 'none';
          el.style.wordBreak = 'break-all';
          el.style.pointerEvents = 'none';

          if (document.body.lastElementChild !== el) {
            document.body.appendChild(el);
          }
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
              const isReel = /\/reels?\//.test(location.pathname);

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
              const isReel = /\/reels?\//.test(location.pathname);

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
        await auto_scroll(page, 8)
        await page.wait_for_timeout(1500)

        current_count = await page.eval_on_selector_all("time", "nodes => nodes.length")
        if current_count > last_count:
            last_count = current_count
            idle = 0
        else:
            idle += 1
        rounds += 1


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


