from urllib.parse import urlparse


_RESERVED_PREFIXES = (
    "p",
    "reel",
    "reels",
    "explore",
    "accounts",
    "direct",
    "stories",
    "locations",
)


def normalize_instagram_url(url: str) -> str:
    return str(url or "").replace("/reels/", "/reel/")


def is_post_or_reel_url(url: str) -> bool:
    path = urlparse(normalize_instagram_url(url)).path.strip("/")
    first = path.split("/", 1)[0] if path else ""
    return first in {"p", "reel"}


def is_profile_url(url: str) -> bool:
    path = urlparse(normalize_instagram_url(url)).path.strip("/")
    if not path:
        return False
    parts = [part for part in path.split("/") if part]
    if len(parts) != 1:
        return False
    return parts[0] not in _RESERVED_PREFIXES


def classify_instagram_url(url: str) -> str:
    if is_post_or_reel_url(url):
        return "post"
    if is_profile_url(url):
        return "profile"
    return "unknown"


def extract_profile_username(url: str) -> str | None:
    if not is_profile_url(url):
        return None
    path = urlparse(normalize_instagram_url(url)).path.strip("/")
    return path or None
