from apify import Actor

from .flow_utils import safe_wait, swallowed
from .screenshots import dump_skip_debug, highlight
from .tuning import (
    EXPAND_TEXT_WAIT_MS,
    HIGHLIGHT_RETRY_WAIT_MS,
    HIGHLIGHT_SCROLL_WAIT_MS,
    PREPARE_SCROLL_WAIT_MS,
    VISUAL_SETTLE_WAIT_MS,
)
from .ui import (
    expand_comment_row_text,
    expand_comments,
    fit_element_in_viewport,
    force_light_mode,
    freeze_animated_media,
    hide_visual_overlays,
    scroll_to_element,
)
from .comment_state import decrement_comment_counters, rollback_comment_seen


async def prepare_comment_for_capture(page, element_handle, comment_container):
    await expand_comments(page, 4)
    with swallowed(Exception):
        await scroll_to_element(page, element_handle, comment_container)
    await safe_wait(page, PREPARE_SCROLL_WAIT_MS)

    with swallowed(Exception):
        for _ in range(3):
            expanded_local = await expand_comment_row_text(page, element_handle, max_clicks=10)
            if not expanded_local:
                break
            await safe_wait(page, EXPAND_TEXT_WAIT_MS)


async def ensure_highlight_ready(*, page, element_handle, data, comment_container):
    await force_light_mode(page)
    await hide_visual_overlays(page)
    highlight_result = {"ok": False, "reason": "not_attempted"}
    for _ in range(3):
        highlight_result = await highlight(page, element_handle, data)
        if highlight_result.get("ok"):
            break
        await safe_wait(page, HIGHLIGHT_RETRY_WAIT_MS)
        with swallowed(Exception):
            await scroll_to_element(page, element_handle, comment_container)
        await safe_wait(page, HIGHLIGHT_SCROLL_WAIT_MS)
    return highlight_result


async def handle_highlight_failure(*, page, kv_store, state, data, highlight_result, strict_key, loose_key, comment_uid, screenshot_timeout_ms):
    reason = highlight_result.get("reason", "unknown")
    extra = ""
    rect = highlight_result.get("rect")
    if rect:
        extra = f" rect={rect}"
    if highlight_result.get("detachedFallbackUsed"):
        extra += " (fallback used)"

    Actor.log.warning(
        f"Highlight fehlgeschlagen für Kommentar #{state['count']} ({data.get('username')}) "
        f"reason={reason}{extra}; Screenshot wird übersprungen."
    )

    try:
        await dump_skip_debug(
            page, kv_store, state["count"], {**data, "highlightResult": highlight_result},
            screenshot_timeout_ms,
        )
    except Exception as dbg_exc:
        Actor.log.warning(f"dump_skip_debug failed: {dbg_exc}")

    decrement_comment_counters(state)
    rollback_comment_seen(state, strict_key, loose_key, comment_uid)


async def prepare_visual_for_screenshot(page, element_handle):
    await freeze_animated_media(page)
    await fit_element_in_viewport(page, element_handle)
    await safe_wait(page, VISUAL_SETTLE_WAIT_MS)


def should_run_geometry_fallback(screenshot_keys, use_3plus_route):
    return len(screenshot_keys) <= 1 and not use_3plus_route


def parts_target_from_ratio(ratio: float) -> int:
    if ratio > 2.2:
        return 4
    if ratio > 1.5:
        return 3
    return 2


async def get_geometry_fallback_metrics(page, element_handle):
    metrics = await page.evaluate(
        """
        (el) => {
          const row = el?.closest?.('li, [role="listitem"], article, div') || el;
          if (!row) return { risk: false, ratio: 1, overflowPx: 0, clippedPx: 0 };
          const r = row.getBoundingClientRect();
          const banner = document.getElementById('apify-screenshot-banner');
          const bannerH = banner ? banner.getBoundingClientRect().height : 0;
          const minTop = 20;
          const maxBottom = window.innerHeight - bannerH - 20;
          const visibleH = Math.max(220, maxBottom - minTop);
          const ratio = Math.max(0, r.height / Math.max(1, visibleH));
          const overflowPx = Math.max(0, r.height - visibleH);
          const clippedTop = Math.max(0, minTop - r.top);
          const clippedBottom = Math.max(0, r.bottom - maxBottom);
          const clippedPx = clippedTop + clippedBottom;

          const risk = overflowPx > 48 || ratio > 1.08 || clippedPx > 36;
          return { risk, ratio, overflowPx, clippedPx };
        }
        """,
        element_handle,
    )
    risk = bool((metrics or {}).get("risk"))
    ratio = float((metrics or {}).get("ratio") or 1)
    return risk, ratio
