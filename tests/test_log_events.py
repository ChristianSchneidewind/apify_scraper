import src.log_events as le


def test_log_event_formats_payload_sorted(monkeypatch):
    msgs = []

    class _Log:
        @staticmethod
        def info(msg):
            msgs.append(msg)

    class _Actor:
        log = _Log()

    monkeypatch.setattr(le, "Actor", _Actor)

    le.log_event("evt", b=2, a=1)
    le.log_event("empty")

    assert msgs[0] == "[evt] a=1 b=2"
    assert msgs[1] == "[empty]"
