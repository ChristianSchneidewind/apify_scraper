# CLI Refactor Status

## State

The TypeScript CLI is the repository's only runtime.

Implemented:

- descriptor-driven modular commands and command-agnostic core
- TypeBox-derived serializable data contracts
- direct CDP browser automation against the running Chrome (no Playwright)
- centralized CDP and callback ports
- typed browser evaluators without dynamic code execution
- strict custom architecture lint rules
- action-verify capture loop with per-run visibility quote and flagging
- optional evidence log with SHA-256 run manifest
- checkpoints and safe resume behavior
- visible comment-like counts
- highlighted single/multipart screenshots
- profile and repost artifact capture

Liker-profile dialog collection is intentionally disabled. Production records use an empty `commentLikers` array and `likersReason: "liker_collection_disabled"`.

## Main entrypoints

- `cli/src/bin/instagram.ts`
- `cli/src/core/app.ts`
- `cli/src/modules/registry.ts`
- module-local `command.ts` and `run.ts` files

## Validation

```bash
npm run lint
npm run typecheck
npm run test:coverage
CI=1 npm run guardrails
```
