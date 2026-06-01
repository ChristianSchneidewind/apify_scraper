import os
import re
import time

from apify import Actor

LIKERS_DEBUG_INLINE = os.getenv("LIKERS_DEBUG_INLINE", "0").strip().lower() in {"1", "true", "yes", "on"}
LIKERS_DEBUG_PROGRESS = os.getenv("LIKERS_DEBUG_PROGRESS", "0").strip().lower() in {"1", "true", "yes", "on"}


async def _collect_open_likers_dialog(page, max_comment_likers: int) -> list[dict]:
    likers = []
    seen = set()
    rounds = 0
    stagnant_rounds = 0
    max_rounds = 240 if max_comment_likers == 0 else 60
    max_stagnant_rounds = 8 if max_comment_likers == 0 else 3

    while rounds < max_rounds:
        rounds += 1
        batch = await page.evaluate(
            r"""
            () => {
              const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
              const d = dialogs[dialogs.length - 1];
              if (!d) return { open: false, items: [], canScroll: false };

              const isProfileHref = (h) => {
                if (!h || !h.startsWith('/')) return false;
                if (h.startsWith('/p/') || h.startsWith('/reel/') || h.startsWith('/reels/')) return false;
                if (h.startsWith('/explore/') || h.startsWith('/accounts/') || h.startsWith('/direct/')) return false;
                if (h.startsWith('/stories/') || h.startsWith('/locations/')) return false;
                if (h.includes('/c/')) return false;
                return /^\/[A-Za-z0-9._]+\/?($|\?)/.test(h);
              };

              const links = Array.from(d.querySelectorAll('a[href]')).filter((a) => isProfileHref(a.getAttribute('href') || ''));
              const items = links.map((a) => {
                const href = a.getAttribute('href') || '';
                const username = (a.textContent || '').trim().replace(/\s+/g, '').replace(/verified$/i, '');
                return { username, profilePath: href };
              }).filter((x) => /^[A-Za-z0-9._]{2,30}$/.test(x.username));

              let scroller = null;
              const candidates = Array.from(d.querySelectorAll('div, ul'))
                .filter((c) => c.scrollHeight > c.clientHeight + 20)
                .sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight));
              if (candidates.length) scroller = candidates[0];

              let canScroll = false;
              if (scroller) {
                const before = scroller.scrollTop;
                const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
                const step = Math.max(260, scroller.clientHeight * 0.95);
                scroller.scrollTop = Math.min(maxScroll, before + step);
                canScroll = Math.abs(scroller.scrollTop - before) > 2;
              }
              return { open: true, items, canScroll };
            }
            """,
        )

        if not (batch or {}).get("open"):
            if LIKERS_DEBUG_PROGRESS:
                Actor.log.info(f"[LIKERS][PROGRESS] stop reason=dialog_closed rounds={rounds} collected={len(likers)}")
            break

        new_added = 0
        for item in (batch or {}).get("items", []):
            u = (item.get("username") or "").strip()
            p = (item.get("profilePath") or "").strip()
            if not u or not p:
                continue
            k = u.lower()
            if k in seen:
                continue
            seen.add(k)
            profile_url = p if p.startswith("http") else f"https://www.instagram.com{p}"
            likers.append({"username": u, "profileUrl": profile_url})
            new_added += 1
            if max_comment_likers and len(likers) >= max_comment_likers:
                break

        if LIKERS_DEBUG_PROGRESS:
            Actor.log.info(
                f"[LIKERS][PROGRESS] round={rounds} batch_items={len((batch or {}).get('items', []))} "
                f"new_added={new_added} canScroll={bool((batch or {}).get('canScroll'))} collected={len(likers)}"
            )

        if max_comment_likers and len(likers) >= max_comment_likers:
            if LIKERS_DEBUG_PROGRESS:
                Actor.log.info(f"[LIKERS][PROGRESS] stop reason=max_comment_likers reached={max_comment_likers}")
            break

        if new_added == 0:
            stagnant_rounds += 1
        else:
            stagnant_rounds = 0

        if not (batch or {}).get("canScroll") and stagnant_rounds >= max_stagnant_rounds:
            if LIKERS_DEBUG_PROGRESS:
                Actor.log.info(
                    f"[LIKERS][PROGRESS] stop reason=no_scroll_and_stagnant rounds={rounds} "
                    f"stagnant_rounds={stagnant_rounds} collected={len(likers)}"
                )
            break

        await page.wait_for_timeout(280 if max_comment_likers == 0 else 220)

    if rounds >= max_rounds and LIKERS_DEBUG_PROGRESS:
        Actor.log.info(f"[LIKERS][PROGRESS] stop reason=max_rounds rounds={rounds} collected={len(likers)} max_rounds={max_rounds}")

    return likers


async def _open_likes_in_current_page(page, element_handle, comment_permalink):
    return await page.evaluate(
        r"""
        ({ el, commentPermalink }) => {
          const isLikeText = (s) => /(\d+[\d.,]*\s*likes?)/i.test(s || '')
            || /(\d+[\d.,]*\s*gefällt\s*mir(?:-angaben|\s*mal)?)/i.test(s || '');

          const row = el?.closest?.('li, [role="listitem"], article, div') || el;
          if (!row) return { ok: false, reason: 'row_missing' };

          const permalinkAnchor = commentPermalink ? document.querySelector(`a[href="${commentPermalink}"]`) : null;
          const rowFromPermalink = permalinkAnchor?.closest?.('li, [role="listitem"], article, div') || permalinkAnchor || null;

          const scopes = [];
          const add = (n) => { if (n && !scopes.includes(n)) scopes.push(n); };
          add(row);
          add(rowFromPermalink);
          add(row?.parentElement);
          add(rowFromPermalink?.parentElement);
          add(row?.parentElement?.parentElement);
          add(rowFromPermalink?.parentElement?.parentElement);

          // climb ancestors from permalink, IG often renders actions in nearby sibling branches
          let cur = permalinkAnchor;
          for (let i = 0; i < 6 && cur; i += 1) {
            add(cur);
            add(cur.parentElement);
            add(cur.parentElement?.nextElementSibling);
            add(cur.parentElement?.previousElementSibling);
            cur = cur.parentElement;
          }

          const txt = scopes.map((s) => (s?.innerText || '')).join(' ').replace(/\s+/g, ' ');
          const m = txt.match(/(\d+[\d.,]*)\s*likes?/i)
            || txt.match(/(\d+[\d.,]*)\s*gefällt\s*mir(?:-angaben|\s*mal)?/i);
          const likesCount = m ? parseInt((m[1] || '').replace(/[.,]/g, ''), 10) || 0 : 0;

          const controls = scopes.flatMap((s) => Array.from(s?.querySelectorAll?.('button, a, [role="button"], [tabindex="0"]') || []));
          let likesBtn = null;
          for (const c of controls) {
            const t = (c.textContent || c.innerText || '').replace(/\s+/g, ' ').trim();
            const aria = (c.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
            if (isLikeText(t) || /like/i.test(aria) || /gefällt mir/i.test(aria)) {
              likesBtn = c;
              break;
            }
          }

          if (!likesBtn) {
            const textNodes = scopes.flatMap((s) => Array.from(s?.querySelectorAll?.('span, div, a, button') || []));
            const hit = textNodes.find((n) => isLikeText((n.textContent || n.innerText || '').replace(/\s+/g, ' ').trim()));
            if (hit) {
              let p = hit;
              for (let i = 0; i < 8 && p; i += 1) {
                const role = (p.getAttribute?.('role') || '').toLowerCase();
                const tab = p.getAttribute?.('tabindex');
                if (p.tagName === 'BUTTON' || p.tagName === 'A' || role === 'button' || tab === '0') {
                  likesBtn = p;
                  break;
                }
                p = p.parentElement;
              }
            }
          }

          if (!likesBtn) return { ok: true, likesCount, clicked: false, reason: 'likes_button_not_found' };
          const clickEl = likesBtn.closest('button, [role="button"], a, [tabindex="0"]') || likesBtn;
          clickEl.click();
          return { ok: true, likesCount, clicked: true };
        }
        """,
        {"el": element_handle, "commentPermalink": comment_permalink},
    )


async def _dialog_is_open(p2) -> bool:
    try:
        return bool(await p2.locator('[role="dialog"]').count())
    except Exception:
        return False


async def _click_likes_on_deep_page(p2, comment_permalink: str | None = None) -> dict:
    likes_count = 0

    if not comment_permalink:
        return {"clicked": False, "likesCount": int(likes_count), "reason": "deep_missing_permalink"}

    anchor = p2.locator(f'a[href="{comment_permalink}"]').first
    if await anchor.count() == 0:
        return {"clicked": False, "likesCount": int(likes_count), "reason": "deep_target_comment_not_found"}

    likes_count = await anchor.evaluate(
        r"""
        (a) => {
          const scope = a?.closest?.('li, [role="listitem"], article, div') || a;
          const txt = (scope?.innerText || '').replace(/\s+/g, ' ');
          const m = txt.match(/(\d+[\d.,]*)\s*likes?/i)
            || txt.match(/(\d+[\d.,]*)\s*gefällt\s*mir(?:-angaben|\s*mal)?/i);
          return m ? parseInt((m[1] || '').replace(/[.,]/g, ''), 10) || 0 : 0;
        }
        """
    )
    scope = anchor.locator('xpath=ancestor-or-self::*[self::li or @role="listitem" or self::article or self::div][1]')

    patterns = [
        (re.compile(r"\d+[\d.,]*\s*likes?", re.I), "pw_text_click"),
        (re.compile(r"\d+[\d.,]*\s*gefällt\s*mir(?:-angaben|\s*mal)?", re.I), "pw_text_click"),
    ]

    for pat, reason in patterns:
        loc = scope.locator('button, a, [role="button"], [tabindex="0"]').filter(has_text=pat)
        cnt = await loc.count()
        for i in range(min(cnt, 6)):
            cand = loc.nth(i)
            try:
                await cand.scroll_into_view_if_needed(timeout=2500)
                await cand.click(timeout=3000)
                await p2.wait_for_timeout(350)
                if await _dialog_is_open(p2):
                    return {"clicked": True, "likesCount": int(likes_count), "reason": f"{reason}_{i}"}
            except Exception:
                continue

    for sel in ['[aria-label*="like" i]', '[aria-label*="gefällt" i]']:
        loc = scope.locator(sel)
        cnt = await loc.count()
        for i in range(min(cnt, 6)):
            cand = loc.nth(i)
            try:
                await cand.scroll_into_view_if_needed(timeout=2500)
                await cand.click(timeout=3000)
                await p2.wait_for_timeout(350)
                if await _dialog_is_open(p2):
                    return {"clicked": True, "likesCount": int(likes_count), "reason": f"pw_aria_click_{i}"}
            except Exception:
                continue

    return {"clicked": False, "likesCount": int(likes_count), "reason": "deep_no_like_in_target_comment"}


async def _debug_inline_like_scope(page, element_handle, comment_permalink):
    try:
        dbg = await page.evaluate(
            r"""
            ({ el, commentPermalink }) => {
              const row = el?.closest?.('li, [role="listitem"], article, div') || el;
              const a = commentPermalink ? document.querySelector(`a[href="${commentPermalink}"]`) : null;
              const rowFromPermalink = a?.closest?.('li, [role="listitem"], article, div') || a || null;

              const scopes = [];
              if (row) scopes.push(row);
              if (rowFromPermalink && rowFromPermalink !== row) scopes.push(rowFromPermalink);
              if (row?.parentElement) scopes.push(row.parentElement);
              if (rowFromPermalink?.parentElement) scopes.push(rowFromPermalink.parentElement);

              const controls = scopes.flatMap((s) => Array.from(s?.querySelectorAll?.('button, a, [role="button"], [tabindex="0"]') || []));
              const sample = controls.slice(0, 20).map((c) => ({
                tag: c.tagName,
                role: c.getAttribute('role') || '',
                tab: c.getAttribute('tabindex') || '',
                aria: (c.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 120),
                text: (c.textContent || c.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120),
              }));

              return {
                permalinkFound: Boolean(a),
                rowFound: Boolean(row),
                rowFromPermalinkFound: Boolean(rowFromPermalink),
                scopes: scopes.length,
                controlsTotal: controls.length,
                sample,
              };
            }
            """,
            {"el": element_handle, "commentPermalink": comment_permalink},
        )
        Actor.log.info(f"[LIKERS][DEBUG] inline-scope permalinkFound={dbg.get('permalinkFound')} rowFound={dbg.get('rowFound')} rowFromPermalinkFound={dbg.get('rowFromPermalinkFound')} scopes={dbg.get('scopes')} controlsTotal={dbg.get('controlsTotal')}")
        Actor.log.info(f"[LIKERS][DEBUG] inline-controls-sample={dbg.get('sample')}")
    except Exception as e:
        Actor.log.info(f"[LIKERS][DEBUG] inline-scope debug failed: {e}")


async def enrich_comment_likers(
    page,
    element_handle,
    data: dict,
    max_comment_likers: int = 50,
    liker_collection_mode: str = "best_effort",
) -> dict:
    started_at = time.perf_counter()
    if not element_handle:
        return data

    comment_permalink = data.get("commentPermalink")
    comment_url = None
    if isinstance(comment_permalink, str) and comment_permalink:
        comment_url = comment_permalink if comment_permalink.startswith("http") else f"https://www.instagram.com{comment_permalink}"
    data.setdefault("commentLikers", [])

    try:
        Actor.log.info(f"[LIKERS] start user={data.get('username')} permalink={comment_permalink}")
        result = await _open_likes_in_current_page(page, element_handle, comment_permalink)
        if not isinstance(result, dict):
            result = {"ok": False, "clicked": False, "likesCount": 0, "reason": "invalid_result"}

        inline_likes = result.get("likesCount")
        if inline_likes is None:
            inline_likes = data.get("likesCount")
        data["likesCount"] = int(inline_likes or 0)
        Actor.log.info(f"[LIKERS] inline likesCount={data['likesCount']} clicked={bool(result.get('clicked'))} reason={result.get('reason')}")
        if not result.get("clicked") and LIKERS_DEBUG_INLINE:
            await _debug_inline_like_scope(page, element_handle, comment_permalink)

        worked_page = page
        if not comment_permalink:
            Actor.log.info("[LIKERS] skip: missing comment_permalink")

        should_try_fallback = bool(comment_url) and bool(comment_permalink) and not result.get("clicked")
        if should_try_fallback and data.get("likesCount", 0) == 0:
            should_try_fallback = False

        if should_try_fallback:
            Actor.log.info("[LIKERS] trying comment-url fallback")
            p2 = await page.context.new_page()
            try:
                await p2.goto(comment_url, wait_until="domcontentloaded")
                # Keep fallback page open long enough so IG can hydrate comment UI.
                await p2.wait_for_timeout(3500)
                # Prefer Playwright click path in deep-link window.
                result2 = await _click_likes_on_deep_page(p2, comment_permalink=comment_permalink)
                deep_likes = result2.get("likesCount")
                if deep_likes is None:
                    deep_likes = data.get("likesCount")
                data["likesCount"] = int(deep_likes or 0)
                deep_reason = result2.get("reason")
                Actor.log.info(f"[LIKERS] deep likesCount={data['likesCount']} clicked={bool(result2.get('clicked'))} reason={deep_reason}")
                if result2.get("clicked"):
                    worked_page = p2
                    # Keep dialog page stable before extraction.
                    await worked_page.wait_for_timeout(1200)
                else:
                    if deep_reason in {"deep_no_like_in_target_comment", "deep_target_comment_not_found", "deep_missing_permalink"}:
                        Actor.log.info(f"[LIKERS] skip: no valid like target for this comment ({deep_reason})")
                    await p2.close()
            except Exception as e:
                Actor.log.warning(f"[LIKERS] deep-link fallback failed: {e}")
                try:
                    await p2.close()
                except Exception:
                    pass

        # If nothing was clicked, do not wait for dialog.
        if worked_page is page and not result.get("clicked"):
            data.setdefault("commentLikers", [])
            return data

        # Wait until likes dialog is actually present; IG opens it asynchronously.
        dialog_open = False
        for _ in range(20):
            is_open = await worked_page.evaluate(
                r"""
                () => {
                  const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
                  return dialogs.length > 0;
                }
                """
            )
            if is_open:
                dialog_open = True
                break
            await worked_page.wait_for_timeout(180)

        if not dialog_open:
            if data.get("likesCount", 0) > 0 and (worked_page is page):
                Actor.log.warning("[LIKERS] dialog did not open in time")
            else:
                pass
            data.setdefault("commentLikers", [])
            if worked_page is not page:
                try:
                    await worked_page.close()
                except Exception:
                    pass
            return data

        await worked_page.wait_for_timeout(900)
        likers = await _collect_open_likers_dialog(worked_page, max_comment_likers=max_comment_likers)

        # IG sometimes opens the likes dialog first and hydrates entries a moment later.
        # Retry once for positive-like comments before closing the dialog.
        if not likers and int(data.get("likesCount") or 0) > 0:
            try:
                await worked_page.wait_for_timeout(1200)
                await worked_page.evaluate(
                    """
                    () => {
                      const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
                      const d = dialogs[dialogs.length - 1];
                      if (!d) return;
                      const candidates = Array.from(d.querySelectorAll('div, ul'));
                      for (const c of candidates) {
                        if (c.scrollHeight > c.clientHeight + 20) {
                          c.scrollTop += Math.max(300, c.clientHeight * 0.9);
                          break;
                        }
                      }
                    }
                    """
                )
                await worked_page.wait_for_timeout(700)
            except Exception:
                pass
            likers = await _collect_open_likers_dialog(worked_page, max_comment_likers=max_comment_likers)

        data["commentLikers"] = likers
        Actor.log.info(f"[LIKERS] collected={len(likers)}")

        if liker_collection_mode == "strict":
            likes_count = int(data.get("likesCount") or 0)
            if likes_count > 0 and len(likers) < likes_count:
                try:
                    await worked_page.wait_for_timeout(1200)
                    retry_likers = await _collect_open_likers_dialog(worked_page, max_comment_likers=max_comment_likers)
                    if len(retry_likers) > len(likers):
                        likers = retry_likers
                        data["commentLikers"] = likers
                except Exception:
                    pass

                if len(data.get("commentLikers") or []) < likes_count:
                    Actor.log.warning(
                        f"[LIKERS] strict_incomplete user={data.get('username')} "
                        f"collected={len(data.get('commentLikers') or [])} likesCount={likes_count}"
                    )

        # Keep zero-like comments fast; for positive-like but empty result, do not close instantly.
        try:
            if int(data.get("likesCount") or 0) > 0 and not likers:
                await worked_page.wait_for_timeout(1000)
            await worked_page.keyboard.press("Escape")
            await worked_page.wait_for_timeout(150)
        except Exception:
            pass
        if worked_page is not page:
            try:
                await worked_page.close()
            except Exception:
                pass

    except Exception as exc:
        Actor.log.warning(f"comment likers enrich failed: {exc}")

    elapsed_ms = int((time.perf_counter() - started_at) * 1000)
    Actor.log.info(
        f"[LIKERS] done user={data.get('username')} likesCount={int(data.get('likesCount') or 0)} "
        f"collected={len(data.get('commentLikers') or [])} elapsedMs={elapsed_ms}"
    )
    return data
