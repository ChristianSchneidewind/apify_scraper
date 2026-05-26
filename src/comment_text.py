import re

from apify import Actor


def normalize_comment_likers(raw_likers):
    normalized_likers = []
    for lk in raw_likers or []:
        if not isinstance(lk, dict):
            continue
        username = (lk.get("username") or "").strip()
        profile_path = (lk.get("profilePath") or "").strip()
        profile_url = (lk.get("profileUrl") or "").strip()
        if not profile_url and profile_path:
            profile_url = profile_path if profile_path.startswith("http") else f"https://www.instagram.com{profile_path}"
        if username and profile_url:
            normalized_likers.append({"username": username, "profileUrl": profile_url})
    return normalized_likers


def build_comment_links(comment_permalink, source_url):
    comment_url = (
        f"https://www.instagram.com{comment_permalink}"
        if isinstance(comment_permalink, str) and comment_permalink.startswith("/")
        else comment_permalink
    )

    comment_deep_link = None
    comment_id = None
    if isinstance(comment_permalink, str):
        m = re.search(r"/c/(\d+)", comment_permalink)
        if m:
            comment_id = m.group(1)

    if comment_id:
        base_post_url = (source_url or "").split("?")[0]
        if "/reels/" in base_post_url:
            base_post_url = base_post_url.replace("/reels/", "/reel/")
        sep = "&" if "?" in base_post_url else "?"
        comment_deep_link = f"{base_post_url}{sep}comment_id={comment_id}"

    return comment_url, comment_deep_link


def build_comment_context(data: dict, source_url: str):
    comment_permalink = data.get("commentPermalink")
    comment_url, comment_deep_link = build_comment_links(comment_permalink, source_url)
    return comment_permalink, comment_url, comment_deep_link


def should_log_screenshot(index: int, log_every_n_screenshots: int) -> bool:
    return (
        log_every_n_screenshots <= 1
        or index <= 5
        or (index % log_every_n_screenshots == 0)
    )


def log_gif_comment_if_needed(data: dict, index: int):
    if data.get("isGifOnly"):
        Actor.log.info(f"GIF-only comment detected: {data.get('username')} #{index}")
