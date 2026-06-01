import os

from src.config import parse_input


def test_parse_input_defaults_and_bounds():
    cfg = parse_input({"urls": ["https://www.instagram.com/p/abc/"]})

    assert cfg["urls"] == ["https://www.instagram.com/p/abc/"]
    assert cfg["max_comments"] == 0
    assert cfg["max_ui_rounds"] >= 1
    assert cfg["screenshot_timeout_ms"] == 60000


def test_parse_input_filters_invalid_urls_and_casts_values():
    cfg = parse_input(
        {
            "urls": ["https://ok", "http://ok2", "ftp://bad", 42],
            "maxComments": "12",
            "headful": "false",
            "viewportWidth": 100,
            "viewportHeight": 99999,
        }
    )

    assert cfg["urls"] == ["https://ok", "http://ok2"]
    assert cfg["max_comments"] == 12
    assert cfg["headful"] is False
    assert cfg["viewport_width"] == 320
    assert cfg["viewport_height"] == 4320


def test_parse_input_bool_string_variants_and_numeric_clamps():
    cfg = parse_input(
        {
            "urls": ["https://ok"],
            "loginEnabled": "yes",
            "saveLoginState": "on",
            "debugNetwork": "1",
            "manualDebugMode": "true",
            "manualDebugOnly": "0",
            "maxUiRounds": -5,
            "uiIdleRounds": 0,
            "loadTimeoutSecs": 1,
            "requestHandlerTimeoutSecs": 10,
            "manualDebugPauseSecs": 0,
            "maxRescanPasses": -3,
            "maxCommentLikers": -1,
        }
    )

    assert cfg["login_enabled"] is True
    assert cfg["save_login_state"] is True
    assert cfg["debug_network"] is True
    assert cfg["manual_debug_mode"] is True
    assert cfg["manual_debug_only"] is False

    assert cfg["max_ui_rounds"] == 1
    assert cfg["ui_idle_rounds"] == 1
    assert cfg["load_timeout_secs"] == 10
    assert cfg["request_handler_timeout_secs"] == 60
    assert cfg["manual_debug_pause_secs"] == 1
    assert cfg["max_rescan_passes"] == 0
    assert cfg["max_comment_likers"] == 0


def test_parse_input_uses_env_for_credentials_when_not_in_input(monkeypatch):
    monkeypatch.setenv("INSTAGRAM_USERNAME", "env_user")
    monkeypatch.setenv("INSTAGRAM_PASSWORD", "env_pass")

    cfg = parse_input({"urls": ["https://ok"]})

    assert cfg["login_username"] == "env_user"
    assert cfg["login_password"] == "env_pass"


def test_parse_input_input_credentials_override_env(monkeypatch):
    monkeypatch.setenv("INSTAGRAM_USERNAME", "env_user")
    monkeypatch.setenv("INSTAGRAM_PASSWORD", "env_pass")

    cfg = parse_input(
        {
            "urls": ["https://ok"],
            "loginUsername": "input_user",
            "loginPassword": "input_pass",
        }
    )

    assert cfg["login_username"] == "input_user"
    assert cfg["login_password"] == "input_pass"
