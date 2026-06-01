import hashlib

from apify import Actor

from .comment_visual_helpers import get_geometry_fallback_metrics, parts_target_from_ratio, should_run_geometry_fallback
from .flow_utils import retry_async, safe_wait
from .log_events import log_event
from .multipart_planner import plan_comment_multipart
from .payloads import build_metadata_payload
from .screenshots import (
    dump_skip_debug,
    highlight,
    run_3plus_capture_fallback,
    save_comment_metadata,
    save_screenshot,
)
from .ui import fit_element_in_viewport, set_screenshot_banner


def build_verify_payload(*, data, element_handle, comment_container, mode, part_top, part_idx, total_parts, base_sig):
    return {
        "el": element_handle,
        "commentContainer": comment_container,
        "mode": mode,
        "top": part_top,
        "part": part_idx,
        "totalParts": total_parts,
        "commentPermalink": data.get("commentPermalink"),
        "userProfilePath": data.get("userProfilePath"),
        "username": data.get("username"),
        "text": data.get("text"),
        "baseSig": base_sig,
    }


async def run_3plus_fallback_with_context(*, page, element_handle, comment_container, data, screenshot_uuid, screenshot_utc, parts_target, base_sig, screenshot_timeout_ms, kv_store, run_folder, state, screenshot_keys, screenshot_paths):
    await run_3plus_capture_fallback(
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
        state=state,
        screenshot_keys=screenshot_keys,
        screenshot_paths=screenshot_paths,
        comment_index=state["count"],
    )


async def capture_comment_assets(
    *,
    page,
    kv_store,
    context,
    comment_container,
    element_handle,
    data,
    state,
    run_folder,
    screenshot_timeout_ms,
    screenshot_uuid,
    screenshot_utc,
    screenshot_keys,
    screenshot_paths,
    metadata_path,
    comment_permalink,
    comment_url,
    comment_deep_link,
):
    try:
        plan = await plan_comment_multipart(page=page, element_handle=element_handle, data=data, state=state)
        scroll_parts = plan["scroll_parts"]
        mode = plan["mode"]
        base_sig = plan["base_sig"]
        total_parts = plan["total_parts"]
        use_3plus_route = plan["use_3plus_route"]
        planned_parts_3plus = plan["planned_parts_3plus"]

        if total_parts > 1:
            log_event("multipart.plan", index=state["count"], mode=mode, parts=total_parts)
        if use_3plus_route:
            log_event("multipart.route_3plus", index=state["count"], parts=planned_parts_3plus)
            scroll_parts = []

        prev_row_top = None
        prev_row_bottom = None
        for part_idx, part_top in enumerate(scroll_parts, start=1):
            verify = await page.evaluate(
                """
                ({ el, commentContainer, mode, top, part, totalParts, commentPermalink, userProfilePath, username, text, baseSig }) => {
                  const norm = (s) => (s || '').toLowerCase().replace(/\\s+/g, ' ').trim();
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
                  if (mode === 'inner') {
                    const candidates = Array.from(row.querySelectorAll('*')).filter((node) => {
                      if (!(node instanceof HTMLElement)) return false;
                      const cs = window.getComputedStyle(node);
                      const overflowY = (cs.overflowY || '').toLowerCase();
                      const scrollableStyle = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
                      return scrollableStyle && (node.scrollHeight - node.clientHeight > 24) && node.clientHeight >= 60;
                    });
                    if (!candidates.length) return { ok: false, reason: 'inner_scroll_missing' };
                    candidates.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight));
                    candidates[0].scrollTop = Math.max(0, Number(top || 0));
                  }
                  row.setAttribute('data-apify-active-row', '1');
                  row.setAttribute('data-apify-highlight', '1');
                  row.style.outline = '3px solid red';
                  row.style.outlineOffset = '2px';
                  row.style.boxShadow = '0 0 0 3px red inset';
                  const rr = row.getBoundingClientRect();
                  return { ok: true, rowTop: rr.top, rowBottom: rr.bottom };
                }
                """,
                build_verify_payload(
                    data=data,
                    element_handle=element_handle,
                    comment_container=comment_container,
                    mode=mode,
                    part_top=part_top,
                    part_idx=part_idx,
                    total_parts=total_parts,
                    base_sig=base_sig,
                ),
            )
            if not (verify or {}).get("ok"):
                log_event("multipart.abort", index=state["count"], reason=(verify or {}).get("reason", "verify_failed"))
                break

            row_top = float((verify or {}).get("rowTop") or 0)
            row_bottom = float((verify or {}).get("rowBottom") or 0)
            if part_idx > 1 and prev_row_top is not None and prev_row_bottom is not None:
                if abs(row_top - prev_row_top) < 18 and abs(row_bottom - prev_row_bottom) < 18:
                    Actor.log.info(f"Multipart part {part_idx}/{total_parts} for #{state['count']} has minimal movement; capturing anyway.")
            prev_row_top = row_top
            prev_row_bottom = row_bottom

            await safe_wait(page, 180)
            if mode != "row":
                await fit_element_in_viewport(page, element_handle)
            rehighlight_ok = False
            hl = {"ok": False, "reason": "not_attempted"}
            try:
                async def _attempt_highlight():
                    nonlocal hl
                    hl = await highlight(page, element_handle, data)
                    if not (hl or {}).get("ok"):
                        raise RuntimeError((hl or {}).get("reason", "unknown"))
                    return hl

                await retry_async(_attempt_highlight, attempts=2, base_delay_ms=120, backoff=1.0)
                rehighlight_ok = True
            except Exception as hl_exc:
                log_event("multipart.rehighlight_failed", index=state["count"], part=part_idx, total=total_parts, reason=str(hl_exc))

            if not rehighlight_ok and part_idx > 1:
                log_event("multipart.part_skipped", index=state["count"], part=part_idx, total=total_parts, reason="missing_highlight")
                continue
            await set_screenshot_banner(page, page.url, f"{screenshot_utc} | c#{state['count']} | {screenshot_uuid[:8]} | part {part_idx}/{total_parts}")

            buffer = await page.screenshot(full_page=False, timeout=screenshot_timeout_ms)
            current_hash = hashlib.sha256(buffer).hexdigest()
            if current_hash == state["last_screenshot_hash"] and not (total_parts > 1 and part_idx > 1):
                log_event("multipart.part_dedup_hash", index=state["count"], part=part_idx, total=total_parts)
                continue

            part_suffix = "" if part_idx == 1 else f"-part{part_idx}"
            screenshot_key = f"{screenshot_uuid}{part_suffix}.png"
            await kv_store.set_value(screenshot_key, buffer, content_type="image/png")
            screenshot_path = await save_screenshot(buffer, screenshot_key, subdir=run_folder)
            screenshot_keys.append(screenshot_key)
            screenshot_paths.append(screenshot_path)
            state["last_screenshot_hash"] = current_hash

        need_long_comment_fallback = bool(use_3plus_route)
        parts_target = planned_parts_3plus if use_3plus_route else 2
        if use_3plus_route:
            await run_3plus_fallback_with_context(
                page=page, element_handle=element_handle, comment_container=comment_container, data=data,
                screenshot_uuid=screenshot_uuid, screenshot_utc=screenshot_utc, parts_target=parts_target,
                base_sig=base_sig, screenshot_timeout_ms=screenshot_timeout_ms, kv_store=kv_store,
                run_folder=run_folder, state=state, screenshot_keys=screenshot_keys, screenshot_paths=screenshot_paths,
            )

        if should_run_geometry_fallback(screenshot_keys, use_3plus_route):
            try:
                need_long_comment_fallback, ratio = await get_geometry_fallback_metrics(page, element_handle)
                parts_target = parts_target_from_ratio(ratio)
                if need_long_comment_fallback and parts_target >= 3:
                    await run_3plus_fallback_with_context(
                        page=page, element_handle=element_handle, comment_container=comment_container, data=data,
                        screenshot_uuid=screenshot_uuid, screenshot_utc=screenshot_utc, parts_target=parts_target,
                        base_sig=base_sig, screenshot_timeout_ms=screenshot_timeout_ms, kv_store=kv_store,
                        run_folder=run_folder, state=state, screenshot_keys=screenshot_keys, screenshot_paths=screenshot_paths,
                    )
            except Exception:
                need_long_comment_fallback = False

        if screenshot_keys:
            metadata_payload = build_metadata_payload(
                screenshot_uuid=screenshot_uuid,
                screenshot_utc=screenshot_utc,
                data=data,
                index=state["count"],
                source_url=context.request.url,
                comment_permalink=comment_permalink,
                comment_url=comment_url,
                comment_deep_link=comment_deep_link,
                screenshot_keys=screenshot_keys,
            )
            metadata_path = save_comment_metadata(metadata_payload, screenshot_keys[0], subdir=run_folder)
    except Exception as exc:
        Actor.log.warning(f"Screenshot failed for comment {state['count']}: {exc}")
        await dump_skip_debug(page, kv_store, state["count"], data, screenshot_timeout_ms)

    return metadata_path
