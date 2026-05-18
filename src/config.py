import os

from .constants import VIEWPORT_HEIGHT, VIEWPORT_WIDTH


def parse_input(input_data: dict) -> dict:
    return {
        "urls": input_data.get("urls", []),
        "max_comments": input_data.get("maxComments") or 0,
        "max_ui_rounds": input_data.get("maxUiRounds", 40),
        "ui_idle_rounds": input_data.get("uiIdleRounds", 6),
        "load_timeout_secs": input_data.get("loadTimeoutSecs", 120),
        "screenshot_timeout_ms": int(input_data.get("screenshotTimeoutSecs", 60) * 1000),
        "request_handler_timeout_secs": int(input_data.get("requestHandlerTimeoutSecs", 7200)),
        "login_enabled": input_data.get("loginEnabled", False),
        "login_username": input_data.get("loginUsername") or os.getenv("INSTAGRAM_USERNAME"),
        "login_password": input_data.get("loginPassword") or os.getenv("INSTAGRAM_PASSWORD"),
        "login_state_key": input_data.get("loginStateKey", "LOGIN_STATE"),
        "save_login_state": input_data.get("saveLoginState", True),
        "headful": input_data.get("headful", False),
        "window_pos_x": int(input_data.get("windowPosX", 0)),
        "window_pos_y": int(input_data.get("windowPosY", 0)),
        "slow_mo_ms": int(input_data.get("slowMoMs", 0)),
        "debug_network": bool(input_data.get("debugNetwork", False)),
        "log_every_n_screenshots": int(input_data.get("logEveryNScreenshots", 25)),
        "debug_har": bool(input_data.get("debugHar", False)),
        "debug_devtools": bool(input_data.get("debugDevtools", False)),
        "manual_debug_mode": bool(input_data.get("manualDebugMode", False)),
        "manual_debug_only": bool(input_data.get("manualDebugOnly", False)),
        "manual_debug_pause_secs": int(input_data.get("manualDebugPauseSecs", 180)),
        "force_single_concurrency": bool(input_data.get("forceSingleConcurrency", True)),
        "no_new_rounds_before_rescan": int(input_data.get("noNewRoundsBeforeRescan", 5)),
        "max_rescan_passes": int(input_data.get("maxRescanPasses", 1)),
        "viewport_width": int(input_data.get("viewportWidth", VIEWPORT_WIDTH)),
        "viewport_height": int(input_data.get("viewportHeight", VIEWPORT_HEIGHT)),
        "maximize_window": bool(input_data.get("maximizeWindow", True)),
    }
