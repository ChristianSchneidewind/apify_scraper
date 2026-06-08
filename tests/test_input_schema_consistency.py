import json
from pathlib import Path

from src.config import parse_input


def _load_input_schema() -> dict:
    return json.loads(Path("INPUT_SCHEMA.json").read_text(encoding="utf-8"))


def test_input_schema_defaults_match_parse_input_defaults():
    schema = _load_input_schema()
    props = schema["properties"]
    cfg = parse_input({"urls": ["https://www.instagram.com/p/abc/"]})

    direct_mappings = {
        "runtimeProfile": "runtime_profile",
        "maxComments": "max_comments",
        "loginEnabled": "login_enabled",
        "loginStateKey": "login_state_key",
        "saveLoginState": "save_login_state",
        "headful": "headful",
        "windowPosX": "window_pos_x",
        "windowPosY": "window_pos_y",
        "maximizeWindow": "maximize_window",
        "slowMoMs": "slow_mo_ms",
        "maxUiRounds": "max_ui_rounds",
        "uiIdleRounds": "ui_idle_rounds",
        "viewportWidth": "viewport_width",
        "viewportHeight": "viewport_height",
        "logEveryNScreenshots": "log_every_n_screenshots",
        "loadTimeoutSecs": "load_timeout_secs",
        "requestHandlerTimeoutSecs": "request_handler_timeout_secs",
        "forceSingleConcurrency": "force_single_concurrency",
        "noNewRoundsBeforeRescan": "no_new_rounds_before_rescan",
        "maxRescanPasses": "max_rescan_passes",
        "debugNetwork": "debug_network",
        "debugHar": "debug_har",
        "debugDevtools": "debug_devtools",
        "manualDebugMode": "manual_debug_mode",
        "manualDebugOnly": "manual_debug_only",
        "manualDebugPauseSecs": "manual_debug_pause_secs",
        "safeInteractionMode": "safe_interaction_mode",
        "maxCommentLikers": "max_comment_likers",
        "likerCollectionMode": "liker_collection_mode",
    }

    for schema_key, config_key in direct_mappings.items():
        assert cfg[config_key] == props[schema_key]["default"], schema_key

    assert cfg["screenshot_timeout_ms"] == props["screenshotTimeoutSecs"]["default"] * 1000


def test_input_schema_enums_match_config_normalization():
    schema = _load_input_schema()
    props = schema["properties"]

    runtime_profile_enum = set(props["runtimeProfile"]["enum"])
    liker_mode_enum = set(props["likerCollectionMode"]["enum"])

    assert runtime_profile_enum == {"fast", "balanced", "deep"}
    assert liker_mode_enum == {"best_effort", "strict"}

    for value in runtime_profile_enum:
        cfg = parse_input({"urls": ["https://www.instagram.com/p/abc/"], "runtimeProfile": value})
        assert cfg["runtime_profile"] == value

    for value in liker_mode_enum:
        cfg = parse_input({"urls": ["https://www.instagram.com/p/abc/"], "likerCollectionMode": value})
        assert cfg["liker_collection_mode"] == value


def test_input_schema_requires_urls():
    schema = _load_input_schema()
    assert schema["required"] == ["urls"]
