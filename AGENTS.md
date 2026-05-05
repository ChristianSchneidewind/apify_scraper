# Project context

We are building a **self-hosted Apify Actor** in **Python** that scrapes Instagram comments and takes full-page screenshots with a red outline around each comment. The project runs locally with a Python venv and Playwright.

## Current files
- `main.py`: Python Actor implementation
- `INPUT_SCHEMA.json`: Actor input schema
- `requirements.txt`: Python deps (`apify`, `playwright`, `python-dotenv`)
- `.env`: holds `INSTAGRAM_USERNAME` and `INSTAGRAM_PASSWORD`

## Key behaviors
- Uses Playwright to open the post page, load comments (UI mode) with aggressive scrolling / load-more.
- Extracts comments via `time` elements and filters out UI labels.
- Highlights each comment element in red and takes a full-page screenshot.
- Saves screenshots to `Screenshots/` and writes data to the Apify dataset.
- Login state can be persisted in KV store via `LOGIN_STATE`.

## Running locally
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install
python3 -m main
```

## Input defaults (storage/key_value_stores/default/INPUT.json)
```json
{
  "urls": ["https://www.instagram.com/p/DWHWE2vDbdr/"],
  "maxComments": 0,
  "screenshotTimeoutSecs": 60,
  "loginEnabled": true,
  "loginStateKey": "LOGIN_STATE",
  "saveLoginState": true,
  "headful": false,
  "maxUiRounds": 120,
  "uiIdleRounds": 15
}
```

## Known limitations
Instagram may limit visible comments; UI scraping is stable but may not reach all comments. API mode was blocked by Instagram.
