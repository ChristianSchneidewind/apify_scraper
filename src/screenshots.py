import json
import re

from .constants import SCREENSHOTS_DIR


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


