# Architecture Overview

## Runtime Flow

1. `cli/src/bin/instagram.ts` is the entrypoint.
2. `cli/src/core/app.ts` parses CLI input and dispatches commands.
3. `cli/src/modules/auth/login.ts` handles session login.
4. `cli/src/modules/scrape-comments/run.ts` orchestrates comment scraping.
5. `cli/src/modules/scrape-profiles/run.ts` orchestrates profile scraping.

## Main areas

- `cli/src/core/`
  - argv parsing
  - runtime context
  - result/output rendering

- `cli/src/adapters/`
  - Playwright browser/session helpers
  - Instagram DOM/browser scripts
  - filesystem output helpers

- `cli/src/modules/scrape-comments/`
  - UI loop
  - extraction
  - likers
  - highlighting
  - multipart capture
  - artifact persistence

- `cli/src/modules/scrape-profiles/`
  - profile extraction
  - screenshot + JSON persistence

- `cli/src/schemas/`
  - centralized TypeBox schemas/types

## Comment scraping flow

1. open browser/profile
2. navigate to target post/reel
3. prepare comments UI
4. loop comment candidates
5. enrich likes/likers
6. highlight and capture screenshots
7. write JSON artifacts

## Extension points

- selectors/browser scripts: `cli/src/adapters/instagram/`
- comment extraction: `cli/src/modules/scrape-comments/browser-scripts/`
- liker handling: `cli/src/modules/scrape-comments/likers/`
- multipart behavior: `cli/src/modules/scrape-comments/multipart/`
