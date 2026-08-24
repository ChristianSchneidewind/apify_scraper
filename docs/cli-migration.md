# CLI Migration

The migration is complete. This repository ships only the TypeScript Instagram CLI runtime.

## Commands

- `instagram auth login`
- `instagram scrape comments --url ...`
- `instagram scrape profiles --url ... --profile-slug ... --out-dir ...`
- `instagram scrape reposts --url ... --out-dir ...`
- `instagram --cdp-url <url>` displays the CDP connection without attaching to Chrome

## Architecture

Commands are descriptor-driven modules. A small command-agnostic core handles validation, context, dispatch, and output. Serializable contracts are TypeBox-derived, browser evaluators are TypeScript functions, and custom guardrails enforce file/function/indentation/type boundaries.

Comment scraping includes visible like counts, highlighting, checkpoints, and multipart screenshots. Liker-profile dialog collection remains intentionally disabled.
