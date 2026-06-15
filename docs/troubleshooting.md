# Troubleshooting

## No comments captured

Check:
- valid Instagram URL
- authenticated session if needed
- Instagram login wall or modal blockers

Try:
- increase `--max-ui-rounds`
- increase `--ui-idle-rounds`
- run with `--verbose`

## Likers lower than likesCount

Notes:
- Instagram often exposes only visible/loadable likers
- default `--max-comment-likers 0` already means all visible likers

Try:
- `--liker-collection-mode strict`
- `--verbose`

## 0-like comments

The CLI should not click the normal reaction button for 0-like comments.
Deep fallback is skipped when `likesCount === 0`.

## Slow runs

Typical causes:
- comment expansion
- liker dialog scrolling
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
