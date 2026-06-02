from .log_events import warn_event


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
