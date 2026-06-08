from .click_guard import build_safe_click_js_helpers, dismiss_suspicious_dialog_if_present
from .comment_decisions import calc_forced_parts, should_force_row_multipart, should_use_3plus_route, total_parts as calc_total_parts
from .comment_pipeline_helpers import FORCED_MULTIPART_BASE, LONG_TEXT_THRESHOLD
from .log_events import log_event, warn_suppressed_exception


def build_comment_locator_payload(data, element_handle):
    return {
        "el": element_handle,
        "commentPermalink": data.get("commentPermalink"),
        "userProfilePath": data.get("userProfilePath"),
        "username": data.get("username"),
        "text": data.get("text"),
    }


async def plan_comment_multipart(*, page, element_handle, data, state):
    if len((data.get("text") or "")) >= LONG_TEXT_THRESHOLD:
        try:
            script = r"""
                (el) => {
                  const row = el?.closest?.('li, [role="listitem"], article, div') || el;
                  if (!row) return;
                  __HELPERS__
                  const controls = Array.from(row.querySelectorAll('button, [role="button"], a, span[role="button"]'));
                  for (const c of controls) {
                    const t = norm(c.innerText || c.textContent || '');
                    if (!t || isOptionsTrigger(c)) continue;
                    if (
                      t === 'more' || t === 'mehr' || t.includes('read more') || t.includes('see more') ||
                      t.includes('weiterlesen') || t.includes('mehr anzeigen') || t.includes('view more')
                    ) {
                      try { c.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); } catch (e) {}
                    }
                  }
                  const textNodes = row.querySelectorAll('span, div, p');
                  for (const n of textNodes) {
                    if (!(n instanceof HTMLElement)) continue;
                    const style = n.style;
                    style.setProperty('max-height', 'none', 'important');
                    style.setProperty('height', 'auto', 'important');
                    style.setProperty('overflow', 'visible', 'important');
                    style.setProperty('-webkit-line-clamp', 'unset', 'important');
                    style.setProperty('line-clamp', 'unset', 'important');
                  }
                }
                """.replace("__HELPERS__", build_safe_click_js_helpers())
            await page.evaluate(script, element_handle)
            if await dismiss_suspicious_dialog_if_present(page, source="multipart_planner.long_text_expand"):
                return {
                    "scroll_parts": [0],
                    "mode": "single",
                    "base_sig": None,
                    "total_parts": 1,
                    "use_3plus_route": False,
                    "planned_parts_3plus": 1,
                }
            await page.wait_for_timeout(160)
        except Exception as exc:
            warn_suppressed_exception("multipart.long_text_expand_failed", exc, index=state["count"])

    part_plan = await page.evaluate(
        """
        ({ el, commentPermalink, userProfilePath, username, text }) => {
          const norm = (s) => (s || '').toLowerCase().replace(/\\s+/g, ' ').trim();
          const user = norm(username);
          const txt = norm(text).slice(0, 180);
          const rowFrom = (node) => node?.closest?.('li, [role="listitem"], article, div') || node;
          let base = rowFrom(el);
          const findByPermalink = () => {
            if (!commentPermalink) return null;
            const a = document.querySelector(`a[href="${commentPermalink}"]`);
            return a ? rowFrom(a) : null;
          };
          const findByProfileAndText = () => {
            if (!userProfilePath) return null;
            const anchors = Array.from(document.querySelectorAll(`a[href="${userProfilePath}"]`));
            for (const a of anchors) {
              const r = rowFrom(a);
              const content = norm(r?.innerText || '');
              if (user && !content.includes(user)) continue;
              if (txt && !content.includes(txt.slice(0, 80))) continue;
              return r;
            }
            return anchors[0] ? rowFrom(anchors[0]) : null;
          };
          if (!base || !document.body.contains(base)) base = findByPermalink() || findByProfileAndText() || base;
          if (!base) return { ok: false, mode: 'single', tops: [0], sig: null };
          const sig = `${norm(base.querySelector('a[href^="/"]')?.getAttribute('href') || '')}|${norm(base.querySelector('time')?.getAttribute('datetime') || base.querySelector('time')?.textContent || '')}|${norm(base.innerText).slice(0, 180)}`;
          const banner = document.getElementById('apify-screenshot-banner');
          const bannerH = banner ? banner.getBoundingClientRect().height : 0;
          const visibleH = Math.max(220, window.innerHeight - bannerH - 48);
          const rowRect = base.getBoundingClientRect();
          const rowTooTall = rowRect.height > (visibleH * 0.82);
          const candidates = Array.from(base.querySelectorAll('*')).filter((node) => {
            if (!(node instanceof HTMLElement)) return false;
            const cs = window.getComputedStyle(node);
            const overflowY = (cs.overflowY || '').toLowerCase();
            const scrollableStyle = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
            return scrollableStyle && (node.scrollHeight - node.clientHeight > 24) && node.clientHeight >= 60;
          });
          let mode = rowTooTall ? 'row' : 'single';
          let tops = [0];
          if (!rowTooTall && candidates.length) {
            candidates.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight));
            const target = candidates[0];
            const maxScroll = Math.max(0, target.scrollHeight - target.clientHeight);
            if (maxScroll > 24) {
              mode = 'inner';
              const step = Math.max(140, target.clientHeight - 40);
              tops = [0];
              let cur = 0;
              while (cur < maxScroll && tops.length < 4) {
                cur = Math.min(maxScroll, cur + step);
                if (cur > tops[tops.length - 1]) tops.push(cur);
              }
            }
          }
          if (mode === 'row') tops = [0, 1];
          return { ok: true, mode, tops, sig };
        }
        """,
        build_comment_locator_payload(data, element_handle),
    )

    if not (part_plan or {}).get("ok"):
        part_plan = {"mode": "single", "tops": [0], "sig": None}

    scroll_parts = (part_plan or {}).get("tops") or [0]
    mode = (part_plan or {}).get("mode") or "single"
    base_sig = (part_plan or {}).get("sig")

    text_len = len((data.get("text") or "").strip())
    if should_force_row_multipart(text_len=text_len, mode=mode, threshold=FORCED_MULTIPART_BASE):
        mode = "row"
        text_parts = calc_forced_parts(text_len=text_len, base=FORCED_MULTIPART_BASE)
        scroll_parts = list(range(max(2, text_parts)))
        log_event("multipart.forced", index=state["count"], text_len=text_len, mode="row", parts=len(scroll_parts))

    total_parts = calc_total_parts(scroll_parts)
    use_3plus_route = should_use_3plus_route(total_parts)

    return {
        "scroll_parts": scroll_parts,
        "mode": mode,
        "base_sig": base_sig,
        "total_parts": total_parts,
        "use_3plus_route": use_3plus_route,
        "planned_parts_3plus": total_parts,
    }
