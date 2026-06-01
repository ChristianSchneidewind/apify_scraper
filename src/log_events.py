import json

from apify import Actor


def _format_payload(fields: dict) -> str:
    parts = []
    for key in sorted(fields):
        value = fields[key]
        if isinstance(value, (dict, list, tuple)):
            encoded = json.dumps(value, ensure_ascii=False, sort_keys=True)
        else:
            encoded = str(value)
        parts.append(f"{key}={encoded}")
    return " ".join(parts)


def log_event(event: str, **fields):
    payload = _format_payload(fields)
    Actor.log.info(f"[{event}] {payload}" if payload else f"[{event}]")


def warn_event(event: str, **fields):
    payload = _format_payload(fields)
    Actor.log.warning(f"[{event}] {payload}" if payload else f"[{event}]")
