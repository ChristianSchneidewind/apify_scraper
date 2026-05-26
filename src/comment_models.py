from dataclasses import dataclass, field
from typing import Any, TypedDict


class CommentData(TypedDict, total=False):
    username: str
    text: str
    isGifOnly: bool
    datetime: str | None
    timeText: str | None
    commentPermalink: str | None
    userProfilePath: str | None
    likesCount: int
    commentLikers: list[dict[str, Any]]


class RunState(TypedDict):
    count: int
    new_in_round: int
    last_screenshot_hash: str | None
    seen_strict: set[str]
    seen_loose: set[str]
    seen_comment_uid: set[str]


@dataclass(slots=True)
class ScreenshotSession:
    screenshot_uuid: str
    screenshot_paths: list[str] = field(default_factory=list)
    screenshot_keys: list[str] = field(default_factory=list)
    metadata_path: str | None = None
    screenshot_utc: str = ""
