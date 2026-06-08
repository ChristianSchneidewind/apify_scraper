import asyncio

import src.profile_capture as pc


class FakeKV:
    def __init__(self):
        self.calls = []

    async def set_value(self, key, value, content_type=None):
        self.calls.append((key, content_type, value))


class FakeDataset:
    def __init__(self):
        self.items = []

    async def push_data(self, item):
        self.items.append(item)


class FakePage:
    def __init__(self):
        self.waits = []

    async def wait_for_timeout(self, ms):
        self.waits.append(ms)
        return None

    async def screenshot(self, full_page=False, timeout=None):
        return b"profile-image"


def test_capture_profile_page_persists_dataset_and_artifacts(monkeypatch):
    kv = FakeKV()
    dataset = FakeDataset()

    async def _extract(_page, _source_url):
        return {
            "username": "nasa",
            "fullName": "NASA",
            "biography": "Space",
            "stats": ["1 post"],
            "avatarUrl": "https://img",
        }

    monkeypatch.setattr(pc, "extract_profile_page_data", _extract)
    monkeypatch.setattr(pc, "init_screenshot_session", lambda: type("S", (), {"screenshot_uuid": "u1", "screenshot_utc": "2026"})())

    async def _save_screenshot(_buffer, filename, subdir=None):
        return f"/tmp/{subdir}/{filename}"

    monkeypatch.setattr(pc, "save_screenshot", _save_screenshot)
    monkeypatch.setattr(pc, "save_comment_metadata", lambda metadata, filename, subdir=None: f"/tmp/{subdir}/{filename}.json")

    page = FakePage()

    count = asyncio.run(
        pc.capture_profile_page(
            page=page,
            dataset=dataset,
            kv_store=kv,
            run_folder="run-folder",
            source_url="https://www.instagram.com/nasa/",
            screenshot_timeout_ms=1000,
            profile_capture_wait_secs=4,
        )
    )

    assert count == 1
    assert page.waits == [4000]
    assert kv.calls[0][0] == "u1-profile.png"
    assert dataset.items[0]["itemType"] == "profile"
    assert dataset.items[0]["profileUsername"] == "nasa"
