import hashlib
import json
import re
import secrets
import time
from datetime import datetime, timezone

from apify import Actor

from .comment_models import ScreenshotSession
from .constants import SCREENSHOTS_DIR


async def highlight(page, element_handle, comment_data):
    if not element_handle:
        return {"ok": False, "reason": "no_element_handle"}

    result = await page.evaluate(
        """
        (payload) => {
          const { el, username, text, isGifOnly, commentPermalink, userProfilePath } = payload;
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

          const isPostPage = /\\/p\\//.test(location.pathname);

          const isProfileHref = (h) => {
            if (!h || !h.startsWith('/')) return false;
            if (h.startsWith('/p/') || h.startsWith('/reel/') || h.startsWith('/reels/')) return false;
            if (h.startsWith('/explore/') || h.startsWith('/accounts/') || h.startsWith('/direct/')) return false;
            if (h.startsWith('/stories/') || h.startsWith('/locations/')) return false;
            if (h.includes('/c/')) return false;
            return /^\\/[A-Za-z0-9._]+\\/?($|\\?)/.test(h);
          };

          const containsProfileLink = (node) => !!node && Array.from(node.querySelectorAll('a[href]'))
            .some((a) => isProfileHref(a.getAttribute('href') || ''));

          const isTightPostRow = (node) => {
            if (!node || !node.getBoundingClientRect) return false;
            const r = node.getBoundingClientRect();
            if (!(r.width >= 220 && r.height >= 28 && r.height <= 520)) return false;
            const perm = node.querySelectorAll?.('a[href*="/c/"]') || [];
            if (perm.length !== 1) return false;
            if (!containsProfileLink(node)) return false;
            if (!node.querySelector?.('time')) return false;
            return true;
          };

          // Fallback search: when the original element handle is detached (IG
          // virtualises comment rows after scrolling) or has lost its DOM
          // identity, locate a fresh row by matching the comment permalink /
          // profile path / username + text.
          const elAttached = !!el && document.body && document.body.contains(el);
          let detachedFallbackUsed = false;
          let workingEl = el;
          if (!elAttached) {
            let candidate = null;
            if (commentPermalink) {
              const anchor = document.querySelector(`a[href="${commentPermalink}"]`);
              if (anchor) candidate = anchor;
            }
            if (!candidate && userProfilePath) {
              const anchors = Array.from(document.querySelectorAll(`a[href="${userProfilePath}"]`));
              for (const a of anchors) {
                const surroundings = (a.closest('article, div, li, [role="listitem"]')?.innerText || '').toLowerCase();
                if (!isGifOnly && fullText && surroundings.includes(fullText)) {
                  candidate = a;
                  break;
                }
                if (isGifOnly && user && surroundings.includes(user)) {
                  candidate = a;
                  break;
                }
              }
              if (!candidate && anchors.length) candidate = anchors[0];
            }
            if (candidate) {
              workingEl = candidate;
              detachedFallbackUsed = true;
            } else {
              return { ok: false, reason: 'detached_no_fallback', isPostPage };
            }
          }

          let row = null;
          if (isPostPage) {
            if (isTightPostRow(workingEl)) {
              row = workingEl;
            }
            if (!row) {
              const liAncestor = workingEl?.closest?.('li, [role="listitem"]');
              if (liAncestor && isTightPostRow(liAncestor)) {
                row = liAncestor;
              }
            }
            if (!row) {
              let cur = workingEl?.parentElement;
              for (let i = 0; i < 24 && cur; i += 1) {
                if (isTightPostRow(cur)) {
                  row = cur;
                  break;
                }
                cur = cur.parentElement;
              }
            }
            if (!row && workingEl) {
              const descendants = workingEl.querySelectorAll?.('a[href*="/c/"]') || [];
              for (const anchor of descendants) {
                let cur = anchor.parentElement;
                for (let i = 0; i < 18 && cur && cur !== workingEl.parentElement; i += 1) {
                  if (isTightPostRow(cur)) {
                    row = cur;
                    break;
                  }
                  cur = cur.parentElement;
                }
                if (row) break;
              }
            }
            if (!row) row = workingEl;
          }
          if (!row) {
            row = workingEl?.closest?.('li, [role="listitem"], article') || workingEl;
          }

          // 2) For reels keep flexible ancestor search; for posts keep locked row.
          if (!isPostPage) {
            let current = row;
            for (let i = 0; i < 6 && current; i += 1) {
              const r = current.getBoundingClientRect();
              if (matchesRow(current) && hasAvatar(current) && r.width >= 160 && r.height >= 24 && r.height <= 420) {
                row = current;
              }
              current = current.parentElement;
            }

            if (!matchesRow(row)) {
              current = workingEl;
              for (let i = 0; i < 8 && current; i += 1) {
                const r = current.getBoundingClientRect();
                if (matchesRow(current) && r.width >= 160 && r.height >= 24 && r.height <= 420) {
                  row = current;
                  break;
                }
                current = current.parentElement;
              }
            }
          }

          const finalTarget = row || workingEl;
          const rect = finalTarget.getBoundingClientRect();
          const validSize = rect.width >= 120 && rect.height >= 20 && rect.height <= (isPostPage ? 900 : 420);
          if (!validSize) {
            return {
              ok: false,
              reason: 'invalid_size',
              isPostPage,
              detachedFallbackUsed,
              rect: { w: Math.round(rect.width), h: Math.round(rect.height) },
            };
          }

          if (isPostPage) {
            const hasTime =
              !!finalTarget.querySelector?.('time') ||
              !!workingEl?.querySelector?.('time') ||
              !!(workingEl && (() => {
                let n = workingEl;
                for (let i = 0; i < 18 && n; i += 1) {
                  if (n.querySelector?.('time')) return true;
                  n = n.parentElement;
                }
                return false;
              })());
            if (!hasTime) return { ok: false, reason: 'no_time', isPostPage, detachedFallbackUsed };
            if (!containsProfileLink(finalTarget)) {
              return { ok: false, reason: 'no_profile_link', isPostPage, detachedFallbackUsed };
            }
          } else if (!matchesRow(finalTarget)) {
            return { ok: false, reason: 'row_does_not_match_text', isPostPage, detachedFallbackUsed };
          }

          const hasProfilePicture = (root) => {
            if (!root || !root.querySelector) return false;
            const imgs = Array.from(root.querySelectorAll('img'));
            return imgs.some((img) => {
              const alt = (img.getAttribute('alt') || '').toLowerCase();
              const cls = String(img.getAttribute('class') || '').toLowerCase();
              const r = img.getBoundingClientRect?.() || { width: 0, height: 0 };
              const looksAvatar =
                alt.includes('profile picture') ||
                alt.includes('profilbild') ||
                alt.includes("'s profile") ||
                cls.includes('avatar');
              const sizeOk = r.width >= 24 && r.width <= 80 && r.height >= 24 && r.height <= 80;
              return looksAvatar || sizeOk;
            });
          };

          let highlightTarget = finalTarget;
          if (!hasProfilePicture(highlightTarget)) {
            const baseRect = finalTarget.getBoundingClientRect();
            let current = finalTarget.parentElement;
            for (let i = 0; i < 6 && current; i += 1) {
              const r = current.getBoundingClientRect();
              const perms = current.querySelectorAll?.('a[href*="/c/"]') || [];
              if (perms.length > 1) break;
              if (r.height > baseRect.height + 240) break;
              if (r.width > baseRect.width + 200) break;
              if (hasProfilePicture(current)) {
                highlightTarget = current;
                break;
              }
              current = current.parentElement;
            }
          }

          highlightTarget.setAttribute('data-apify-highlight', '1');
          highlightTarget.style.outline = '3px solid red';
          highlightTarget.style.outlineOffset = '2px';
          highlightTarget.style.boxShadow = '0 0 0 3px red inset';
          highlightTarget.style.backgroundClip = 'padding-box';
          return {
            ok: true,
            reason: 'highlighted',
            isPostPage,
            detachedFallbackUsed,
            expandedForAvatar: highlightTarget !== finalTarget,
          };
        }
        """,
        {
            "el": element_handle,
            "username": comment_data.get("username"),
            "text": comment_data.get("text"),
            "isGifOnly": bool(comment_data.get("isGifOnly")),
            "commentPermalink": comment_data.get("commentPermalink"),
            "userProfilePath": comment_data.get("userProfilePath"),
        },
    )
    if not isinstance(result, dict):
        return {"ok": bool(result), "reason": "legacy_bool"}
    return result


def make_post_slug(url):
    return re.sub(r"[^a-zA-Z0-9]+", "-", re.sub(r"^https?://", "", url)).strip("-").lower()


def make_uuid7():
    ts_ms = int(time.time() * 1000) & ((1 << 48) - 1)
    rand_a = secrets.randbits(12)
    rand_b = secrets.randbits(62)

    value = (ts_ms << 80) | (0x7 << 76) | (rand_a << 64) | (0b10 << 62) | rand_b
    hex_str = f"{value:032x}"
    return f"{hex_str[0:8]}-{hex_str[8:12]}-{hex_str[12:16]}-{hex_str[16:20]}-{hex_str[20:32]}"


async def save_screenshot(buffer, filename, subdir=None):
    target_dir = SCREENSHOTS_DIR / subdir if subdir else SCREENSHOTS_DIR
    target_dir.mkdir(parents=True, exist_ok=True)
    file_path = target_dir / filename
    if file_path.exists():
        stem = file_path.stem
        suffix = file_path.suffix
        n = 1
        while True:
            candidate = target_dir / f"{stem}-{n}{suffix}"
            if not candidate.exists():
                file_path = candidate
                break
            n += 1
    file_path.write_bytes(buffer)
    return str(file_path)


def save_comment_metadata(metadata, screenshot_filename, subdir=None):
    target_dir = SCREENSHOTS_DIR / subdir if subdir else SCREENSHOTS_DIR
    target_dir.mkdir(parents=True, exist_ok=True)
    stem = screenshot_filename.rsplit('.', 1)[0]
    file_path = target_dir / f"{stem}.json"
    file_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    return str(file_path)


async def capture_comment_multipart_3plus(
    *,
    page,
    element_handle,
    comment_container,
    data,
    screenshot_uuid,
    screenshot_utc,
    parts_target,
    base_sig,
    screenshot_timeout_ms,
    kv_store,
    run_folder,
    last_screenshot_hash,
):
    screenshot_keys = []
    screenshot_paths = []

    Actor.log.info(f"[3+PART] ENTER uuid={screenshot_uuid[:8]} parts_target={parts_target} user={data.get('username')}")

    for tile_idx in range(1, parts_target + 1):
        tile = await page.evaluate(
            r"""
            ({ el, commentContainer, partIndex, partsTotal, commentPermalink, userProfilePath, username, text, baseSig }) => {
              const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
              const user = norm(username);
              const txt = norm(text).slice(0, 180);
              const rowFrom = (node) => node?.closest?.('li, [role="listitem"], article, div') || node;

              const findRow = () => {
                if (commentPermalink) {
                  const a = document.querySelector(`a[href="${commentPermalink}"]`);
                  if (a) return rowFrom(a);
                }
                if (userProfilePath) {
                  const anchors = Array.from(document.querySelectorAll(`a[href="${userProfilePath}"]`));
                  for (const a of anchors) {
                    const r = rowFrom(a);
                    const content = norm(r?.innerText || '');
                    if (user && !content.includes(user)) continue;
                    if (txt && !content.includes(txt.slice(0, 80))) continue;
                    return r;
                  }
                  if (anchors[0]) return rowFrom(anchors[0]);
                }
                return rowFrom(el);
              };

              const row = findRow();
              if (!row || !document.body.contains(row)) return { ok: false, reason: 'row_not_found' };

              const sig = `${norm(row.querySelector('a[href^="/"]')?.getAttribute('href') || '')}|${norm(row.querySelector('time')?.getAttribute('datetime') || row.querySelector('time')?.textContent || '')}|${norm(row.innerText).slice(0, 180)}`;
              if (baseSig && sig && baseSig.split('|').slice(0,2).join('|') !== sig.split('|').slice(0,2).join('|')) {
              }

              const banner = document.getElementById('apify-screenshot-banner');
              const bannerH = banner ? banner.getBoundingClientRect().height : 0;
              const minTop = 20;
              const maxBottom = window.innerHeight - bannerH - 20;
              const visibleH = Math.max(220, maxBottom - minTop);

              let r = row.getBoundingClientRect();
              const overflow = Math.max(0, r.height - visibleH);
              const overlapRatio = partsTotal >= 3 ? 0.22 : 0.35;
              const stepPx = Math.max(120, visibleH * (1 - overlapRatio));
              let segmentTop = Math.round(Math.min(overflow, Math.max(0, (partIndex - 1) * stepPx)));
              if (partIndex >= partsTotal) segmentTop = Math.round(overflow);
              const desiredTop = minTop - segmentTop;

              const parent = (() => {
                if (commentContainer && commentContainer instanceof HTMLElement) return commentContainer;
                let cur = row.parentElement;
                while (cur) {
                  if (cur.scrollHeight - cur.clientHeight > 20) return cur;
                  cur = cur.parentElement;
                }
                return null;
              })();

              if (parent) {
                const maxScroll = Math.max(0, parent.scrollHeight - parent.clientHeight);
                for (let i = 0; i < 8; i += 1) {
                  r = row.getBoundingClientRect();
                  const delta = r.top - desiredTop;
                  if (Math.abs(delta) < 6) break;
                  const next = Math.max(0, Math.min(maxScroll, parent.scrollTop + delta));
                  const before = parent.scrollTop;
                  parent.scrollTop = next;
                  const moved = Math.abs(parent.scrollTop - before);
                  if (moved < 2) {
                    window.scrollBy(0, delta);
                  }
                }
              } else {
                for (let i = 0; i < 8; i += 1) {
                  r = row.getBoundingClientRect();
                  const delta = r.top - desiredTop;
                  if (Math.abs(delta) < 6) break;
                  window.scrollBy(0, delta);
                }
              }

              r = row.getBoundingClientRect();
              const clipTop = Math.max(minTop, r.top - 2);
              const clipBottom = Math.min(maxBottom, r.bottom + 2);
              const clipLeft = Math.max(0, r.left - 4);
              const clipRight = Math.min(window.innerWidth, r.right + 4);
              const w = Math.max(1, clipRight - clipLeft);
              const h = Math.max(1, clipBottom - clipTop);
              const useClip = !(h < 80 || w < 120);

              return {
                ok: true,
                clip: useClip ? { x: clipLeft, y: clipTop, width: w, height: h } : null,
                debug: {
                  overflow,
                  segmentTop,
                  desiredTop,
                  rowTop: r.top,
                  rowBottom: r.bottom,
                  visibleH,
                  partIndex,
                  partsTotal,
                  parentScrollTop: parent ? parent.scrollTop : null,
                },
              };
            }
            """,
            {
                "el": element_handle,
                "commentContainer": comment_container,
                "partIndex": tile_idx,
                "partsTotal": parts_target,
                "commentPermalink": data.get("commentPermalink"),
                "userProfilePath": data.get("userProfilePath"),
                "username": data.get("username"),
                "text": data.get("text"),
                "baseSig": base_sig,
            },
        )

        if not (tile or {}).get("ok"):
            Actor.log.warning(f"[3+PART] tile {tile_idx}/{parts_target} failed: {(tile or {}).get('reason', 'tile_failed')}")
            if tile_idx == 1:
                Actor.log.warning(f"Long-comment 3+ fallback aborted: {(tile or {}).get('reason', 'tile_failed')}")
            break

        dbg = (tile or {}).get("debug") or {}
        Actor.log.info(
            f"[3+PART] part {tile_idx}/{parts_target} overflow={dbg.get('overflow')} segmentTop={dbg.get('segmentTop')} rowTop={dbg.get('rowTop')} rowBottom={dbg.get('rowBottom')} visibleH={dbg.get('visibleH')} parentScrollTop={dbg.get('parentScrollTop')}"
        )

        await page.wait_for_timeout(120)
        try:
            await highlight(page, element_handle, data)
        except Exception:
            pass

        clip = tile.get("clip")
        if clip:
            part_buffer = await page.screenshot(
                full_page=False,
                clip={
                    "x": float(clip.get("x", 0)),
                    "y": float(clip.get("y", 0)),
                    "width": float(clip.get("width", 1)),
                    "height": float(clip.get("height", 1)),
                },
                timeout=screenshot_timeout_ms,
            )
        else:
            Actor.log.warning(f"[3+PART] tile {tile_idx}/{parts_target} clip_too_small -> fallback viewport screenshot")
            part_buffer = await page.screenshot(full_page=False, timeout=screenshot_timeout_ms)
        part_hash = hashlib.sha256(part_buffer).hexdigest()
        if part_hash == last_screenshot_hash and tile_idx > 1:
            continue

        part_suffix = "element" if tile_idx == 1 else f"element-part{tile_idx}"
        part_key = f"{screenshot_uuid}-{part_suffix}.png"
        await kv_store.set_value(part_key, part_buffer, content_type="image/png")
        part_path = await save_screenshot(part_buffer, part_key, subdir=run_folder)
        screenshot_keys.append(part_key)
        screenshot_paths.append(part_path)
        last_screenshot_hash = part_hash
        Actor.log.info(f"[3+PART] saved part {tile_idx}/{parts_target} key={part_key}")

    Actor.log.info(f"[3+PART] EXIT uuid={screenshot_uuid[:8]} saved={len(screenshot_keys)}")
    return screenshot_keys, screenshot_paths, last_screenshot_hash


def init_screenshot_session() -> ScreenshotSession:
    return ScreenshotSession(
        screenshot_uuid=make_uuid7(),
        screenshot_paths=[],
        screenshot_keys=[],
        metadata_path=None,
        screenshot_utc=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
    )


async def run_3plus_capture_fallback(
    *,
    page,
    element_handle,
    comment_container,
    data,
    screenshot_uuid,
    screenshot_utc,
    parts_target,
    base_sig,
    screenshot_timeout_ms,
    kv_store,
    run_folder,
    state,
    screenshot_keys,
    screenshot_paths,
    comment_index,
):
    try:
        Actor.log.info(f"[3+PART] CALL for #{comment_index} uuid={screenshot_uuid[:8]} parts_target={parts_target}")
        mp_keys, mp_paths, mp_last_hash = await capture_comment_multipart_3plus(
            page=page,
            element_handle=element_handle,
            comment_container=comment_container,
            data=data,
            screenshot_uuid=screenshot_uuid,
            screenshot_utc=screenshot_utc,
            parts_target=parts_target,
            base_sig=base_sig,
            screenshot_timeout_ms=screenshot_timeout_ms,
            kv_store=kv_store,
            run_folder=run_folder,
            last_screenshot_hash=state["last_screenshot_hash"],
        )
        screenshot_keys.extend(mp_keys)
        screenshot_paths.extend(mp_paths)
        state["last_screenshot_hash"] = mp_last_hash
        Actor.log.info(f"[3+PART] RETURN for #{comment_index} saved={len(mp_keys)}")
        if not mp_keys:
            Actor.log.warning(f"[3+PART] No parts saved for #{comment_index} despite 3+ route.")
    except Exception as fb_exc:
        Actor.log.warning(f"Long-comment 3+ fallback screenshot failed for #{comment_index}: {fb_exc}")


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


