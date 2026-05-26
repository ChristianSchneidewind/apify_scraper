from apify import Actor


def log_event(event: str, **fields):
    payload = " ".join(f"{k}={fields[k]}" for k in sorted(fields))
    Actor.log.info(f"[{event}] {payload}" if payload else f"[{event}]")
