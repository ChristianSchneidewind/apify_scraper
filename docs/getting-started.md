# Getting started

## 1. Install

```bash
npm install
npx playwright install chromium
```

## 2. Create a persistent Instagram session

The CLI uses a local Playwright profile. Log in once with the profile you will use for scraping:

```bash
npx tsx cli/src/bin/instagram.ts auth login \
  --browser-profile default
```

The session is stored below `.instagram-cli/profiles/`. Do not commit this directory.

## 3. Run a small test scrape

Start with a low comment limit:

```bash
npx tsx cli/src/bin/instagram.ts scrape comments \
  --url "https://www.instagram.com/p/POST_ID/" \
  --max-comments 3 \
  --out-dir artifacts/comments
```

The browser is visible by default. Use `--headless` for unattended execution.

## 4. Inspect the result

A timestamped run directory is created below `artifacts/comments/` and contains:

- `comments.json`: final structured result
- `checkpoint.json`: progress saved after each processed comment
- PNG screenshots and JSON metadata per comment
- `capture-debug.jsonl`: capture diagnostics

## 5. Resume or retry

Resume an interrupted run from its checkpoint:

```bash
npx tsx cli/src/bin/instagram.ts scrape comments \
  --url "https://www.instagram.com/p/POST_ID/" \
  --resume "artifacts/comments/<run>/checkpoint.json"
```

Liker-profile collection is currently disabled; liker-related retry flags are retained only for compatibility.

## Profiles

```bash
npx tsx cli/src/bin/instagram.ts scrape profiles \
  --url "https://www.instagram.com/USERNAME/" \
  --profile-slug USERNAME \
  --out-dir artifacts/profiles \
  --json
```
