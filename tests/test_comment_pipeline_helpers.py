import asyncio

import src.comment_pipeline_helpers as cph


class FakeDataset:
    def __init__(self):
        self.items = []

    async def push_data(self, item):
        self.items.append(item)


def test_enrich_and_normalize_likers(monkeypatch):
    async def enrich(_page, _el, data, max_comment_likers, liker_collection_mode):
        assert max_comment_likers == 5
        assert liker_collection_mode == "strict"
        data = dict(data)
        data["commentLikers"] = [{"username": "alice", "profilePath": "/alice/"}]
        return data

    monkeypatch.setattr(cph, "enrich_comment_likers", enrich)

    out = asyncio.run(
        cph.enrich_and_normalize_likers(
            page=object(),
            element_handle=object(),
            data={"username": "u", "text": "t"},
            max_comment_likers=5,
            liker_collection_mode="strict",
        )
    )

    assert out["commentLikers"] == [{"username": "alice", "profileUrl": "https://www.instagram.com/alice/"}]


def test_persist_comment_result_pushes_built_payload(monkeypatch):
    ds = FakeDataset()
    qa = {}

    monkeypatch.setattr(
        cph,
        "build_dataset_payload",
        lambda **kwargs: {
            "id": kwargs["screenshot_uuid"],
            "index": kwargs["index"],
            "username": "u",
            "text": "t",
            "sourceUrl": "https://src",
            "screenshotPaths": ["p1"],
        },
    )

    asyncio.run(
        cph.persist_comment_result(
            dataset=ds,
            screenshot_uuid="u1",
            screenshot_paths=["p1"],
            screenshot_keys=["k1"],
            metadata_path="m1",
            data={"username": "u", "text": "t"},
            index=3,
            source_url="https://src",
            comment_permalink="/p/x/c/1/",
            comment_url="https://www.instagram.com/p/x/c/1/",
            comment_deep_link="https://www.instagram.com/p/x/?comment_id=1",
            qa_state=qa,
        )
    )

    assert ds.items == [{"id": "u1", "index": 3, "username": "u", "text": "t", "sourceUrl": "https://src", "screenshotPaths": ["p1"]}]
    assert qa["items_total"] == 1
    assert qa.get("items_with_missing_fields", 0) == 0
