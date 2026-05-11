
async def extract_comment_from_time(time_handle):
    result = await time_handle.evaluate(
        r"""
        (timeEl) => {
          const ignoreTexts = new Set(['Like', 'Reply', 'Log in', 'Sign up', 'Comment', 'Share', 'Save']);
          const timeText = timeEl.textContent?.trim() ?? null;
          const isValidUsername = (username) => /^[a-zA-Z0-9._]{2,30}$/.test(username || '');
          const isProfileHref = (h) => {
            if (!h || !h.startsWith('/')) return false;
            if (h.startsWith('/p/') || h.startsWith('/reel/') || h.startsWith('/reels/')) return false;
            if (h.startsWith('/explore/') || h.startsWith('/accounts/') || h.startsWith('/direct/')) return false;
            if (h.startsWith('/stories/') || h.startsWith('/locations/')) return false;
            if (h.includes('/c/')) return false;
            return /^\/[A-Za-z0-9._]+\/?($|\?)/.test(h);
          };

          let current = timeEl.parentElement;
          for (let i = 0; i < 24 && current; i += 1) {
            const links = Array.from(current.querySelectorAll('a[role="link"], a'));
            const usernameLink = links.find((a) => isProfileHref(a.getAttribute('href') || ''));

            if (usernameLink) {
              const spans = Array.from(current.querySelectorAll('span'))
                .map((span) => span.textContent?.trim())
                .filter((text) => text && !ignoreTexts.has(text));

              const rawUsername = (usernameLink.textContent || '').trim();
              const username = rawUsername.replace(/\s+/g, '').replace(/verified$/i, '');
              const userProfilePath = usernameLink.getAttribute('href') || null;
              const pickPermalink = (root) => {
                for (const sel of [
                  'a[href*="/p/"][href*="/c/"]',
                  'a[href*="/reel/"][href*="/c/"]',
                  'a[href*="/reels/"][href*="/c/"]',
                  'a[href*="/c/"]',
                ]) {
                  const a = root.querySelector(sel);
                  const h = a?.getAttribute('href');
                  if (h && h.includes('/c/')) return h;
                }
                return null;
              };
              const commentPermalink = pickPermalink(current);
              if (!isValidUsername(username)) {
                current = current.parentElement;
                continue;
              }

              const badText = (t) => {
                const v = (t || '').trim();
                if (!v) return true;
                const l = v.toLowerCase();
                if (['reply', 'replies', 'edited', 'view all replies', 'view hidden comments'].includes(l)) return true;
                if (/^\d+\s*(h|d|w|m|s)$/i.test(v)) return true;
                if (/^\d+\s*likes?$/i.test(v)) return true;
                if (/^\d+h\s*·\s*edited$/i.test(l)) return true;
                return false;
              };

              const text = spans
                .filter((textItem) => textItem !== username && textItem !== rawUsername && textItem !== timeText)
                .sort((a, b) => b.length - a.length)
                .find((t) => !badText(t));

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
                  userProfilePath,
                  commentPermalink,
                  text,
                  datetime: timeEl.getAttribute('datetime') ?? null,
                  timeText,
                  isGifOnly: false,
                };
              }

              if (username && hasGif && cleaned.length === 0) {
                return {
                  username,
                  userProfilePath,
                  commentPermalink,
                  text: '[GIF]',
                  datetime: timeEl.getAttribute('datetime') ?? null,
                  timeText,
                  isGifOnly: true,
                };
              }
            }

            current = current.parentElement;
          }

          // Fallback for post pages where username/text are outside the first ancestor window.
          try {
            const permalinkLink = timeEl.closest(
              'a[href*="/p/"][href*="/c/"], a[href*="/reel/"][href*="/c/"], a[href*="/reels/"][href*="/c/"], a[href*="/c/"]'
            );
            if (permalinkLink) {
              let row = permalinkLink;
              for (let i = 0; i < 14 && row; i += 1) {
                const txt = (row.innerText || '').trim();
                if (txt.length > 20) break;
                row = row.parentElement;
              }
              row = row || permalinkLink.parentElement || permalinkLink;

              const links = Array.from(row.querySelectorAll('a[role="link"], a'));
              const usernameLink = links.find((a) => {
                const href = a.getAttribute('href') ?? '';
                if (!isProfileHref(href)) return false;
                const t = (a.textContent || '').replace(/\s+/g, '').replace(/verified$/i, '');
                return isValidUsername(t);
              });

              const rawUsername = usernameLink?.textContent?.trim() || '';
              const username = rawUsername.replace(/\s+/g, '').replace(/verified$/i, '');
              const userProfilePath = usernameLink?.getAttribute('href') || null;
              const commentPermalink = permalinkLink.getAttribute('href') || null;
              if (!isValidUsername(username)) return null;

              const spans = Array.from(row.querySelectorAll('span'))
                .map((span) => span.textContent?.trim())
                .filter((text) => text && !ignoreTexts.has(text));

              const badText = (t) => {
                const v = (t || '').trim();
                if (!v) return true;
                const l = v.toLowerCase();
                if (['reply', 'replies', 'edited', 'view all replies', 'view hidden comments'].includes(l)) return true;
                if (/^\d+\s*(h|d|w|m|s)$/i.test(v)) return true;
                if (/^\d+\s*likes?$/i.test(v)) return true;
                if (/^\d+h\s*·\s*edited$/i.test(l)) return true;
                return false;
              };

              const text = spans
                .filter((textItem) => textItem !== rawUsername && textItem !== username && textItem !== timeText)
                .sort((a, b) => b.length - a.length)
                .find((t) => !badText(t));

              if (username && text && text.length >= 1) {
                return {
                  username,
                  userProfilePath,
                  commentPermalink,
                  text,
                  datetime: timeEl.getAttribute('datetime') ?? null,
                  timeText,
                  isGifOnly: false,
                };
              }
            }
          } catch (e) {
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
          const isProfileHref = (h) => {
            if (!h || !h.startsWith('/')) return false;
            if (h.startsWith('/p/') || h.startsWith('/reel/') || h.startsWith('/reels/')) return false;
            if (h.startsWith('/explore/') || h.startsWith('/accounts/') || h.startsWith('/direct/')) return false;
            if (h.startsWith('/stories/') || h.startsWith('/locations/')) return false;
            if (h.includes('/c/')) return false;
            return /^\\/[A-Za-z0-9._]+\\/?($|\\?)/.test(h);
          };

          const strictCommentLi = timeEl.closest('li');
          if (strictCommentLi) return strictCommentLi;

          const strictListItem = timeEl.closest('[role="listitem"]');
          if (strictListItem) return strictListItem;

          // NOTE: Don't fall back to closest('article'); on /p/ pages the article
          // wraps the entire post (image + every comment) and would explode the
          // highlighted region. Always walk up to find the tight comment row.
          let current = timeEl.parentElement;
          for (let i = 0; i < 24 && current; i += 1) {
            const profileLink = Array.from(current.querySelectorAll('a[href]'))
              .find((a) => isProfileHref(a.getAttribute('href') || ''));
            const permLinks = current.querySelectorAll('a[href*="/c/"]');
            const rect = current.getBoundingClientRect();
            if (profileLink && permLinks.length === 1
                && rect.width >= 220 && rect.height >= 28 && rect.height <= 520) {
              return current;
            }
            current = current.parentElement;
          }

          // Fallback: first ancestor with reasonable text length AND a bounded
          // height so we don't return the whole article wrapper.
          current = timeEl.parentElement;
          while (current) {
            const txt = (current.innerText || '').trim();
            const rect = current.getBoundingClientRect();
            if (txt.length > 30 && rect.height >= 20 && rect.height <= 900) return current;
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
          const isProfileHref = (h) => {
            if (!h || !h.startsWith('/')) return false;
            if (h.startsWith('/p/') || h.startsWith('/reel/') || h.startsWith('/reels/')) return false;
            if (h.startsWith('/explore/') || h.startsWith('/accounts/') || h.startsWith('/direct/')) return false;
            if (h.startsWith('/stories/') || h.startsWith('/locations/')) return false;
            if (h.includes('/c/')) return false;
            return /^\/[A-Za-z0-9._]+\/?($|\?)/.test(h);
          };

          const links = Array.from(item.querySelectorAll('a[role="link"], a'));
          const usernameLink = links.find((a) => isProfileHref(a.getAttribute('href') || ''));
          const rawUsername = (usernameLink?.textContent || '').trim();
          const username = rawUsername.replace(/\s+/g, '').replace(/verified$/i, '');
          const userProfilePath = usernameLink?.getAttribute('href') || null;
          const pickPermalink = (root) => {
            for (const sel of [
              'a[href*="/p/"][href*="/c/"]',
              'a[href*="/reel/"][href*="/c/"]',
              'a[href*="/reels/"][href*="/c/"]',
              'a[href*="/c/"]',
            ]) {
              const a = root.querySelector(sel);
              const h = a?.getAttribute('href');
              if (h && h.includes('/c/')) return h;
            }
            return null;
          };
          const commentPermalink = pickPermalink(item);
          if (!isValidUsername(username)) return null;

          const timeEl = item.querySelector('time');
          const timeText = timeEl?.textContent?.trim() ?? null;
          const datetime = timeEl?.getAttribute('datetime') ?? null;

          const spans = Array.from(item.querySelectorAll('span'))
            .map((s) => s.textContent?.trim())
            .filter((t) => t && !ignoreTexts.has(t));

          const textCandidates = spans
            .filter((t) => t !== username && t !== rawUsername && t !== timeText)
            .sort((a, b) => b.length - a.length);

          const badText = (t) => {
            const v = (t || '').trim();
            if (!v) return true;
            const l = v.toLowerCase();
            if (['reply', 'replies', 'edited', 'view all replies', 'view hidden comments'].includes(l)) return true;
            if (/^\d+\s*(h|d|w|m|s)$/i.test(v)) return true;
            if (/^\d+\s*likes?$/i.test(v)) return true;
            if (/^\d+h\s*·\s*edited$/i.test(l)) return true;
            return false;
          };

          const text = (textCandidates.find((t) => !badText(t)) || null);
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
            return { username, userProfilePath, commentPermalink, text, datetime, timeText, isGifOnly: false };
          }
          if (hasGif && cleaned.length === 0) {
            return { username, userProfilePath, commentPermalink, text: '[GIF]', datetime, timeText, isGifOnly: true };
          }
          return null;
        }
        """
    )

    if not result:
        return None, None

    return result, item_handle


async def get_dialog_comment_rows(page):
    # Kept for backward compatibility; now also supports normal post pages.
    return await get_comment_rows(page)


async def get_post_comment_rows(page):
    # First prefer DOM with proper list items (older IG rollouts).
    li_rows = await page.query_selector_all(
        'div[role="dialog"] li:has(a[href*="/p/"][href*="/c/"]):has(time), '
        'article li:has(a[href*="/p/"][href*="/c/"]):has(time), '
        'main article li:has(a[href*="/p/"][href*="/c/"]):has(time)'
    )
    if li_rows:
        return li_rows

    # Modern post pages render comments as nested <div>s, no <li>/<article> wrapper per
    # comment. For each unique /p/<post>/c/<commentId>/ permalink we walk up the DOM
    # until we find the smallest ancestor that also contains a profile link, a comment
    # text span and has a reasonable bounding box. That ancestor is the comment row we
    # want to extract from and highlight.
    handles_array = await page.evaluate_handle(
        """
        () => {
          const isProfileHref = (h) => {
            if (!h || !h.startsWith('/')) return false;
            if (h.startsWith('/p/') || h.startsWith('/reel/') || h.startsWith('/reels/')) return false;
            if (h.startsWith('/explore/') || h.startsWith('/accounts/') || h.startsWith('/direct/')) return false;
            if (h.startsWith('/stories/') || h.startsWith('/locations/')) return false;
            if (h.includes('/c/')) return false;
            return /^\\/[A-Za-z0-9._]+\\/?($|\\?)/.test(h);
          };

          const permalinks = Array.from(document.querySelectorAll(
            'a[href*="/p/"][href*="/c/"], a[href*="/reel/"][href*="/c/"], a[href*="/reels/"][href*="/c/"]'
          )).filter((a) => a.querySelector('time'));

          const seen = new Set();
          const rows = [];
          for (const anchor of permalinks) {
            const href = anchor.getAttribute('href') || '';
            const m = href.match(/\\/(p|reel|reels)\\/[^/]+\\/c\\/(\\d+)/);
            if (!m) continue;
            const key = m[2];
            if (seen.has(key)) continue;

            let chosen = null;
            let cur = anchor.parentElement;
            for (let i = 0; i < 24 && cur; i += 1) {
              const profileLink = Array.from(cur.querySelectorAll('a[href]'))
                .find((a) => isProfileHref(a.getAttribute('href') || ''));
              if (!profileLink) {
                cur = cur.parentElement;
                continue;
              }

              const rect = cur.getBoundingClientRect();
              if (rect.width < 220 || rect.height < 28 || rect.height > 520) {
                cur = cur.parentElement;
                continue;
              }

              // Ensure this ancestor wraps exactly this single comment, not several.
              const perm = cur.querySelectorAll('a[href*="/c/"]');
              if (perm.length !== 1) {
                cur = cur.parentElement;
                continue;
              }

              chosen = cur;
              break;
            }

            if (!chosen) continue;
            seen.add(key);
            rows.push(chosen);
          }
          return rows;
        }
        """
    )

    rows = []
    try:
        props = await handles_array.get_properties()
        for prop in props.values():
            element = prop.as_element()
            if element:
                rows.append(element)
            else:
                await prop.dispose()
    finally:
        await handles_array.dispose()

    if rows:
        return rows

    # Last resort: any div carrying a comment permalink + time (may include nested
    # duplicates; deduplication happens further upstream via seen sets).
    return await page.query_selector_all(
        'article div:has(a[href*="/c/"]):has(time), '
        'main article div:has(a[href*="/c/"]):has(time)'
    )


async def get_post_comment_permalinks(page):
    return await page.evaluate(
        """
        () => {
          const links = Array.from(document.querySelectorAll('a[href*="/p/"][href*="/c/"]'));
          const seen = new Set();
          const out = [];

          for (const a of links) {
            const href = a.getAttribute('href') || '';
            if (!href.startsWith('/p/') || !href.includes('/c/')) continue;

            const li = a.closest('li');
            if (!li) continue;

            if (seen.has(href)) continue;
            seen.add(href);
            out.push(href);
          }

          return out;
        }
        """
    )


async def get_comment_rows(page):
    # Strict dialog-first selectors: avoids grabbing unrelated feed/recommendation nodes.
    rows = await page.query_selector_all(
        'div[role="dialog"] ul li:has(time), '
        'div[role="dialog"] li[role="listitem"]:has(time), '
        'div[role="dialog"] li._a9zj:has(time), '
        'div[role="dialog"] li._a9zj._a9zl:has(time)'
    )
    if rows:
        return rows

    # Fallback for post pages without active dialog.
    return await page.query_selector_all(
        'article ul li:has(time), '
        'main article ul li:has(time), '
        'article div:has(a[href*="/p/"][href*="/c/"]):has(time)'
    )


