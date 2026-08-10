# Project context

We are building a **TypeScript Instagram scraping CLI** with **Playwright**. The legacy Python/Apify Actor runtime has been removed; the repository now uses the CLI as the only runtime.

## Current files
- `cli/src/bin/instagram.ts`: CLI entrypoint
- `cli/src/core/app.ts`: command dispatch
- `cli/src/modules/scrape-comments/run.ts`: comment scraping flow
- `cli/src/modules/scrape-profiles/run.ts`: profile scraping flow
- `package.json`: Node/TypeScript dependencies and scripts
- `.env`: optional `INSTAGRAM_USERNAME` and `INSTAGRAM_PASSWORD`

## Key behaviors
- Uses Playwright to open Instagram pages and scrape via the UI.
- Browser runs **headful by default**; use `--headless` to override.
- Scrapes comments, likes, likers, and profile artifacts.
- Highlights each comment with a red outline before screenshots.
- Supports multipart screenshots for long comments.
- Writes local artifacts under `--out-dir`.

## Running locally
```bash
npm install
npx playwright install chromium
npx tsx cli/src/bin/instagram.ts auth login --browser-profile "default"
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
Instagram may limit visible comments; UI scraping is the supported path and may not reach all comments in every case.
