def build_comment_identity(data: dict) -> tuple[str, str]:
    username = (data.get("username") or "").strip().lower()
    text = (data.get("text") or "").strip().lower()
    dt = (data.get("datetime") or "").strip().lower()
    tt = (data.get("timeText") or "").strip().lower()
    is_gif = bool(data.get("isGifOnly"))

    strict_key = f"{username}|{text}|{dt}"
    loose_key = f"gif|{username}|{tt or dt}" if is_gif else f"txt|{username}|{text}|{tt or dt}"
    return strict_key, loose_key


async def compute_comment_uid(page, element_handle):
    return await page.evaluate(
        r"""
        (el) => {
          const row = el?.closest?.('li, [role="listitem"], article') || el;
          if (!row) return null;
          const profileHref = row.querySelector('a[href^="/"]')?.getAttribute('href') || '';
          const timeEl = row.querySelector('time');
          const dt = timeEl?.getAttribute('datetime') || '';
          const tt = (timeEl?.textContent || '').trim().toLowerCase();
          const txt = (row.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
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


def register_comment_seen(state: dict, strict_key: str, loose_key: str, comment_uid: str | None):
    state["seen_strict"].add(strict_key)
    state["seen_loose"].add(loose_key)
    if comment_uid:
        state["seen_comment_uid"].add(comment_uid)


def rollback_comment_seen(state: dict, strict_key: str, loose_key: str, comment_uid: str | None):
    state["seen_strict"].discard(strict_key)
    state["seen_loose"].discard(loose_key)
    if comment_uid:
        state["seen_comment_uid"].discard(comment_uid)


def increment_comment_counters(state: dict):
    state["count"] += 1
    state["new_in_round"] += 1


def decrement_comment_counters(state: dict):
    state["count"] -= 1
    state["new_in_round"] -= 1


async def register_candidate_or_skip(page, state: dict, data: dict, element_handle):
    strict_key, loose_key = build_comment_identity(data)

    if strict_key in state["seen_strict"] or loose_key in state["seen_loose"]:
        return False, strict_key, loose_key, None

    comment_uid = await compute_comment_uid(page, element_handle)
    if comment_uid and comment_uid in state["seen_comment_uid"]:
        return False, strict_key, loose_key, comment_uid

    register_comment_seen(state, strict_key, loose_key, comment_uid)
    return True, strict_key, loose_key, comment_uid
