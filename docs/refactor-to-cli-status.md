# CLI Status

## State

The refactor is complete.

- TypeScript CLI is the only runtime in the repository.
- Comment scraping parity features are implemented:
  - likes + likers
  - highlighted screenshots
  - multipart capture
- Profile scraping is implemented.

## Main entrypoints

- `cli/src/bin/instagram.ts`
- `cli/src/modules/scrape-comments/run.ts`
- `cli/src/modules/scrape-profiles/run.ts`

## Validation

```bash
npm run lint
npm run typecheck
npm run test:coverage
CI=1 npm run guardrails
```
