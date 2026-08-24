# Troubleshooting

## Session expired / auth required

If the CLI reports `Instagram session expired; run auth login first`, authenticate the same browser profile again:

```bash
npx tsx cli/src/bin/instagram.ts auth login --browser-profile "default"
```

Keep the same `--cwd` and `--browser-profile` values for subsequent scrapes.

## No comments captured

Check:
- valid Instagram URL
- authenticated session if needed
- Instagram login wall or modal blockers

Try:
- increase `--max-ui-rounds`
- increase `--ui-idle-rounds`
- run with `--verbose`

## Liker profiles are empty

This is intentional. The production path currently keeps visible `likesCount` but does not open liker dialogs. Comment records contain an empty `commentLikers` array and `likersReason: "liker_collection_disabled"`. Liker-related flags are compatibility placeholders until the UI flow is reliable.


## Resume interrupted runs

Comment runs write `checkpoint.json` after each processed comment. Continue with:

```bash
npx tsx cli/src/bin/instagram.ts scrape comments \
  --url "https://www.instagram.com/p/abc/" \
  --resume "artifacts/comments/<run>/checkpoint.json"
```

## Slow runs

Typical causes:
- comment expansion
- multipart screenshots

Try:
- lower `--max-comments`
- lower `--max-ui-rounds`
- avoid unnecessary verbose runs

## Validation / CI

Run locally:

```bash
npm run lint
npm run typecheck
npm run test:coverage
CI=1 npm run guardrails
```
