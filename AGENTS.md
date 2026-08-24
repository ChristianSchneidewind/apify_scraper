# Project context

We are building a **TypeScript Instagram scraping CLI** that drives the
user's **own, already-installed Chrome** over the **Chrome DevTools Protocol
(CDP)** — no Playwright, no Puppeteer, no bundled browser download.

## Current files
- `cli/src/bin/instagram.ts`: CLI entrypoint
- `cli/src/core/app.ts`: command dispatch
- `cli/src/adapters/cdp/`: CDP client (WebSocket), page/locator/handle layer,
  session attach, action-verify helpers, evidence log
- `cli/src/modules/scrape-comments/run.ts`: comment scraping flow
- `cli/src/modules/scrape-profiles/run.ts`: profile scraping flow
- `package.json`: Node/TypeScript dependencies and scripts

## Key behaviors
- Connects to the running Chrome via `--cdp-url` (default
  `http://127.0.0.1:9222`); the real profile keeps logins, cookies and
  fingerprint, so bot detection is rare.
- Prefers an already-open Instagram tab; otherwise opens a new tab. Closing
  the session never closes the user's Chrome.
- Logins are never automated: the human signs in once in their real Chrome;
  `auth login` only verifies the session state.
- Action-verify loop: after every action the state is re-read; capture
  targets are verified visible before screenshots. Failures are flagged, not
  dropped, and each run ends with a visibility quote.
- `--headless` is a deprecated no-op (CDP mode uses the running Chrome UI).
- Scrapes comments, visible like counts, and profile artifacts.
  Liker-profile collection is temporarily disabled.
- Highlights each comment with a red outline before screenshots.
- Supports multipart screenshots for long comments.
- `--evidence` writes `actions.ndjson` plus a SHA-256 `manifest.json`
  per run directory (Beweissicherung).
- Writes local artifacts under `--out-dir`.

## Running locally
```bash
npm install
# enable remote debugging in Chrome: chrome://inspect/#remote-debugging
# or start Chrome with --remote-debugging-port=9222 (or: chrome-agent launch)
npx tsx cli/src/bin/instagram.ts auth login
npx tsx cli/src/bin/instagram.ts scrape comments --url "https://www.instagram.com/p/abc/" --out-dir "artifacts/comments"
```

## Validation
```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
CI=1 npm run guardrails
```

## Known limitations
Instagram may limit visible comments; UI scraping is the supported path and
may not reach all comments in every case.
