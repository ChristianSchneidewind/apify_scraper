import os

from .constants import VIEWPORT_HEIGHT, VIEWPORT_WIDTH


def _to_int(value, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return int(default)


def _to_int_min(value, default: int, min_value: int) -> int:
    return max(min_value, _to_int(value, default))


def _to_int_range(value, default: int, min_value: int, max_value: int) -> int:
    return max(min_value, min(max_value, _to_int(value, default)))


def _as_bool(value, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def _parse_urls(value) -> list[str]:
    if not isinstance(value, list):
        return []
    urls = []
    for item in value:
        if isinstance(item, str):
            u = item.strip()
            if u.startswith("http://") or u.startswith("https://"):
                urls.append(u)
    return urls


def _liker_collection_mode(value) -> str:
    mode = str(value or "best_effort").strip().lower()
    return mode if mode in {"best_effort", "strict"} else "best_effort"


def parse_input(input_data: dict) -> dict:
    return {
        "urls": _parse_urls(input_data.get("urls", [])),
        "max_comments": _to_int_min(input_data.get("maxComments", 0), 0, 0),
        "max_ui_rounds": _to_int_min(input_data.get("maxUiRounds", 40), 40, 1),
        "ui_idle_rounds": _to_int_min(input_data.get("uiIdleRounds", 6), 6, 1),
        "load_timeout_secs": _to_int_min(input_data.get("loadTimeoutSecs", 120), 120, 10),
        "screenshot_timeout_ms": _to_int_min(input_data.get("screenshotTimeoutSecs", 60), 60, 1) * 1000,
        "request_handler_timeout_secs": _to_int_min(input_data.get("requestHandlerTimeoutSecs", 7200), 7200, 60),
        "login_enabled": _as_bool(input_data.get("loginEnabled"), False),
        "login_username": input_data.get("loginUsername") or os.getenv("INSTAGRAM_USERNAME"),
        "login_password": input_data.get("loginPassword") or os.getenv("INSTAGRAM_PASSWORD"),
        "login_state_key": input_data.get("loginStateKey", "LOGIN_STATE"),
        "save_login_state": _as_bool(input_data.get("saveLoginState"), True),
        "headful": _as_bool(input_data.get("headful"), True),
        "window_pos_x": _to_int(input_data.get("windowPosX", 0), 0),
        "window_pos_y": _to_int(input_data.get("windowPosY", 0), 0),
        "slow_mo_ms": _to_int_min(input_data.get("slowMoMs", 0), 0, 0),
        "debug_network": _as_bool(input_data.get("debugNetwork"), False),
        "log_every_n_screenshots": _to_int_min(input_data.get("logEveryNScreenshots", 25), 25, 1),
        "debug_har": _as_bool(input_data.get("debugHar"), False),
        "debug_devtools": _as_bool(input_data.get("debugDevtools"), False),
        "manual_debug_mode": _as_bool(input_data.get("manualDebugMode"), False),
        "manual_debug_only": _as_bool(input_data.get("manualDebugOnly"), False),
        "manual_debug_pause_secs": _to_int_min(input_data.get("manualDebugPauseSecs", 180), 180, 1),
        "force_single_concurrency": _as_bool(input_data.get("forceSingleConcurrency"), True),
        "no_new_rounds_before_rescan": _to_int_min(input_data.get("noNewRoundsBeforeRescan", 5), 5, 1),
        "max_rescan_passes": _to_int_min(input_data.get("maxRescanPasses", 1), 1, 0),
        "viewport_width": _to_int_range(input_data.get("viewportWidth", VIEWPORT_WIDTH), VIEWPORT_WIDTH, 320, 7680),
        "viewport_height": _to_int_range(input_data.get("viewportHeight", VIEWPORT_HEIGHT), VIEWPORT_HEIGHT, 240, 4320),
        "maximize_window": _as_bool(input_data.get("maximizeWindow"), True),
        "max_comment_likers": _to_int_min(input_data.get("maxCommentLikers", 50), 50, 0),
        "liker_collection_mode": _liker_collection_mode(input_data.get("likerCollectionMode", "best_effort")),
    }
