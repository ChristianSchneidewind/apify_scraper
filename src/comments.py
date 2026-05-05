
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


