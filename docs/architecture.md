# Architecture Overview

## Runtime flow

1. `cli/src/bin/instagram.ts` renders the final typed result.
2. `cli/src/core/app.ts` coordinates help/version, validation, context, and dispatch.
3. `cli/src/core/argv.ts` matches and validates arguments through registered command descriptors.
4. `cli/src/core/dispatch.ts` invokes the matched descriptor.
5. Module handlers run authentication or scraping and return `CliOutput`.

## Small core

`cli/src/core/` is command-agnostic. It owns:

- generic argv validation
- CLI construction from descriptors
- runtime-context construction
- generic dispatch
- output/result and exit-code policy

Guardrails reject Instagram command literals and direct command implementation imports in core.

## Modular commands

Each command defines configuration, accepted flags, request construction, and execution beside its handler:

- `cli/src/modules/auth/command.ts`
- `cli/src/modules/scrape-comments/command.ts`
- `cli/src/modules/scrape-profiles/command.ts`
- `cli/src/modules/scrape-reposts/command.ts`
- `cli/src/modules/profile-command.ts`

`cli/src/modules/registry.ts` is the composition root. Adding a command means adding a descriptor to this registry; parsing, help, and dispatch remain generic.

## Adapters and browser evaluators

- `cli/src/adapters/playwright/`: browser/session lifecycle
- `cli/src/adapters/instagram/`: authentication, selectors, highlighting, and visual preparation
- module-local `browser.ts` files: typed functions passed directly to Playwright `evaluate`
- `cli/src/adapters/filesystem/`: artifact persistence

All runtime files are TypeScript. Dynamic `new Function`, `eval`, and untyped `.script` files are forbidden.

## Central schemas and ports

- Serializable data lives in TypeBox schema modules and types are inferred with `Static`.
- Non-serializable Playwright/callback contracts live in `schemas/ports.ts` and related centralized port modules.
- Local named or inline structural types, explicit `any`, `as never`, and chained unknown assertions are lint errors.

## Comment scraping flow

1. open the selected browser profile
2. navigate to the post or Reel
3. prepare and sort the comments UI
4. discover, extract, and deduplicate candidates
5. retain visible like counts and mark liker profiles disabled
6. validate the exact row, highlight it, and capture single or multipart screenshots
7. persist metadata, checkpoints, and final JSON

The dormant liker experiments remain isolated under `scrape-comments/likers/` and are unreachable from the production path.
