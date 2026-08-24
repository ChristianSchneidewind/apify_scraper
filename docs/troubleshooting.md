# Troubleshooting

## Chrome remote debugging not reachable

If the CLI reports that Chrome remote debugging is not reachable, start the
scraping Chrome:

```bash
scripts/chrome-cdp.sh            # or: scripts/chrome-cdp.sh --restart
```

Chrome >= 136 ignores `--remote-debugging-port` for the default data
directory, which is why the script uses the dedicated profile
`~/.chrome-cdp`. Point `--cdp-url` at the right endpoint when you use a
non-default port.

## Session expired / auth required

If the CLI reports `Instagram session expired; run auth login first`, sign in
to Instagram in the connected Chrome and verify:

```bash
npx tsx cli/src/bin/instagram.ts auth login
```

The session lives in the real Chrome profile; there is no separate CLI profile
to keep in sync.

## Captures flagged as not visible

The action-verify loop flags captures whose target left the viewport instead
of dropping them. The run summary prints the visibility quote; spot-check the
flagged comments via their `commentPermalink` and the `visibleInViewport`
field in the per-comment metadata JSON.

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
