import json

from .log_events import log_event, warn_event


SUSPICIOUS_DIALOG_TERMS = (
    "report",
    "melden",
    "more options",
    "options",
    "optionen",
    "share",
    "teilen",
    "copy link",
    "link kopieren",
)

OPTIONS_TRIGGER_TERMS = (
    "more options",
    "options",
    "optionen",
    "report",
    "melden",
)


def build_safe_click_js_helpers(*, include_comment_context: bool = False, include_like_text: bool = False) -> str:
    options_terms = json.dumps(list(OPTIONS_TRIGGER_TERMS), ensure_ascii=False)
    parts = [
        f"const OPTIONS_TRIGGER_TERMS = {options_terms};",
        "const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim().toLowerCase();",
        "const isOptionsTrigger = (node) => { const combined = [norm(node?.innerText || node?.textContent || ''), norm(node?.getAttribute?.('aria-label')), norm(node?.getAttribute?.('title'))].join(' '); return OPTIONS_TRIGGER_TERMS.some((term) => combined.includes(term)); };",
    ]
    if include_comment_context:
        parts.append(
            "const hasCommentContext = (node) => { const row = node?.closest?.('li, [role=\"listitem\"], article, section, div') || node; if (!row) return false; if (row.querySelector('time')) return true; const rowText = norm(row.innerText || row.textContent || ''); return rowText.includes('reply') || rowText.includes('antwort') || rowText.includes('comment') || rowText.includes('kommentar'); };"
        )
    if include_like_text:
        parts.append(
            "const isLikeText = (s) => /(\\d+[\\d.,]*\\s*likes?)/i.test(s || '') || /(\\d+[\\d.,]*\\s*gefällt\\s*mir(?:-angaben|\\s*mal)?)/i.test(s || '');"
        )
    return "\n".join(parts)


def log_click_attempt(*, source: str, action: str, target: str | None = None, extra: dict | None = None):
    payload = {"source": source, "action": action}
    if target is not None:
        payload["target"] = target
    if isinstance(extra, dict):
        payload.update(extra)
    log_event("ui.click_attempt", **payload)


def log_click_result(*, source: str, action: str, outcome: str, target: str | None = None, extra: dict | None = None):
    payload = {"source": source, "action": action, "outcome": outcome}
    if target is not None:
        payload["target"] = target
    if isinstance(extra, dict):
        payload.update(extra)
    log_event("ui.click_result", **payload)


async def dismiss_suspicious_dialog_if_present(page, *, source: str) -> bool:
    info = await page.evaluate(
        r"""
        (terms) => {
          const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
          const dialog = dialogs[dialogs.length - 1];
          if (!dialog) return { open: false, suspicious: false, text: '' };

          const text = (dialog.innerText || dialog.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          const suspicious = terms.some((term) => text.includes(term));
          return { open: true, suspicious, text: text.slice(0, 240) };
        }
        """,
        list(SUSPICIOUS_DIALOG_TERMS),
    )

    if not isinstance(info, dict) or not info.get("suspicious"):
        return False

    warn_event(
        "ui.suspicious_dialog_detected",
        source=source,
        snippet=info.get("text", ""),
    )

    try:
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(150)
    except Exception:
        pass

    return True
