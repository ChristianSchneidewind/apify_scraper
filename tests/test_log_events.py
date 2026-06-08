import src.log_events as le


def test_log_event_formats_payload_sorted(monkeypatch):
    infos = []
    warns = []

    class _Log:
        @staticmethod
        def info(msg):
            infos.append(msg)

        @staticmethod
        def warning(msg):
            warns.append(msg)

    class _Actor:
        log = _Log()

    monkeypatch.setattr(le, "Actor", _Actor)

    le.log_event("evt", b=2, a=1)
    le.log_event("empty")
    le.warn_event("warn", payload={"x": 1}, vals=[1, 2])
    le.warn_suppressed_exception("suppressed", ValueError("bad"), stage="test")

    assert infos[0] == "[evt] a=1 b=2"
    assert infos[1] == "[empty]"
    assert warns[0] == "[warn] payload={\"x\": 1} vals=[1, 2]"
    assert warns[1] == "[suppressed] error=ValueError('bad') error_type=ValueError stage=test"
