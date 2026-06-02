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


def _is_instagram_url(url: str) -> bool:
    lower = url.lower()
    return (
        lower.startswith("https://www.instagram.com/")
        or lower.startswith("https://instagram.com/")
        or lower.startswith("http://www.instagram.com/")
        or lower.startswith("http://instagram.com/")
    )


def _parse_urls(value) -> list[str]:
    if not isinstance(value, list):
        return []
    urls = []
    for item in value:
        if isinstance(item, str):
            u = item.strip()
            if _is_instagram_url(u):
                urls.append(u)
    return urls


def _liker_collection_mode(value) -> str:
    mode = str(value or "best_effort").strip().lower()
    return mode if mode in {"best_effort", "strict"} else "best_effort"


def _runtime_profile(value) -> str:
    profile = str(value or "balanced").strip().lower()
    return profile if profile in {"fast", "balanced", "deep"} else "balanced"


def parse_input(input_data: dict) -> dict:
    profile = _runtime_profile(input_data.get("runtimeProfile"))
    profile_defaults = {
        "fast": {"max_ui_rounds": 30, "ui_idle_rounds": 4, "load_timeout_secs": 90, "request_handler_timeout_secs": 3600},
        "balanced": {"max_ui_rounds": 40, "ui_idle_rounds": 6, "load_timeout_secs": 120, "request_handler_timeout_secs": 7200},
        "deep": {"max_ui_rounds": 120, "ui_idle_rounds": 15, "load_timeout_secs": 240, "request_handler_timeout_secs": 10800},
    }[profile]

    return {
        "urls": _parse_urls(input_data.get("urls", [])),
        "runtime_profile": profile,
        "max_comments": _to_int_min(input_data.get("maxComments", 0), 0, 0),
        "max_ui_rounds": _to_int_min(input_data.get("maxUiRounds", profile_defaults["max_ui_rounds"]), profile_defaults["max_ui_rounds"], 1),
        "ui_idle_rounds": _to_int_min(input_data.get("uiIdleRounds", profile_defaults["ui_idle_rounds"]), profile_defaults["ui_idle_rounds"], 1),
        "load_timeout_secs": _to_int_min(input_data.get("loadTimeoutSecs", profile_defaults["load_timeout_secs"]), profile_defaults["load_timeout_secs"], 10),
        "screenshot_timeout_ms": _to_int_min(input_data.get("screenshotTimeoutSecs", 60), 60, 1) * 1000,
        "request_handler_timeout_secs": _to_int_min(input_data.get("requestHandlerTimeoutSecs", profile_defaults["request_handler_timeout_secs"]), profile_defaults["request_handler_timeout_secs"], 60),
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
        "safe_interaction_mode": _as_bool(input_data.get("safeInteractionMode"), False),
        "force_single_concurrency": _as_bool(input_data.get("forceSingleConcurrency"), True),
        "no_new_rounds_before_rescan": _to_int_min(input_data.get("noNewRoundsBeforeRescan", 5), 5, 1),
        "max_rescan_passes": _to_int_min(input_data.get("maxRescanPasses", 1), 1, 0),
        "viewport_width": _to_int_range(input_data.get("viewportWidth", VIEWPORT_WIDTH), VIEWPORT_WIDTH, 320, 7680),
        "viewport_height": _to_int_range(input_data.get("viewportHeight", VIEWPORT_HEIGHT), VIEWPORT_HEIGHT, 240, 4320),
        "maximize_window": _as_bool(input_data.get("maximizeWindow"), True),
        "max_comment_likers": _to_int_min(input_data.get("maxCommentLikers", 50), 50, 0),
        "liker_collection_mode": _liker_collection_mode(input_data.get("likerCollectionMode", "best_effort")),
    }
