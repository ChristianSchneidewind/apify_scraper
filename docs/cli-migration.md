# CLI Migration

Migration is complete.

This repository now ships only the TypeScript CLI runtime.

## Current commands

- `instagram auth login`
- `instagram scrape comments --url ...`
- `instagram scrape profiles --url ... --profile-slug ... --out-dir ...`

## Notes

- browser profiles are explicit via `--browser-profile`
- comment scraping includes likes/likers, highlighting, and multipart capture
- output is written as local artifacts
