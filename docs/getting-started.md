# Getting started

## 1. Install

```bash
npm install
```

No browser download is needed: the CLI drives your installed Chrome.

## 2. Enable Chrome remote debugging

Pick one:

- open `chrome://inspect/#remote-debugging` in Chrome and enable the toggle
- start Chrome with `--remote-debugging-port=9222`
- run `chrome-agent launch`

The CLI connects to `http://127.0.0.1:9222` by default; override with
`--cdp-url <url>`. On the first attach Chrome may show a one-time
"allow debugging" dialog — confirm it.

## 3. Verify the Instagram session

Logins are never automated. Sign in to Instagram once in your real Chrome,
then verify:

```bash
npx tsx cli/src/bin/instagram.ts auth login
```

The command reports a clear status instead of failing silently when the
session is missing.

## 4. Run a small test scrape

Start with a low comment limit:

```bash
npx tsx cli/src/bin/instagram.ts scrape comments \
  --url "https://www.instagram.com/p/POST_ID/" \
  --max-comments 3 \
  --out-dir artifacts/comments
```

The run uses the visible Chrome window; `--headless` is deprecated and has
no effect in CDP mode.

## 5. Inspect the result

A timestamped run directory is created below `artifacts/comments/` and contains:

- `comments.json`: final structured result
- `checkpoint.json`: progress saved after each processed comment
- PNG screenshots and JSON metadata per comment (metadata includes the
  `visibleInViewport` flag from the action-verify loop)
- `capture-debug.jsonl`: capture diagnostics
- with `--evidence`: `actions.ndjson` and a SHA-256 `manifest.json`

The run summary ends with a visibility quote, e.g.
`visibility: 42 captures, 97.6% visibility, 1 flagged`. Geflaggte Ausreißer
gezielt per Spot-Check nachprüfen.

## 6. Resume or retry

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
