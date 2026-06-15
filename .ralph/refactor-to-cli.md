# Refactor Apify actor to TypeScript CLI

Refactor the current Python Apify actor into a TypeScript-only CLI with a very small core and highly modular architecture inspired by pi coding agent.

## Goals
- Replace Python runtime implementation with a TypeScript CLI.
- Keep strict typing everywhere.
- Centralize all types/schemas with TypeBox.
- Enforce architecture and size guardrails.
- Add loop-based implementation flow with validator subagent after each phase.

## Checklist
- [x] Write CLI spec and target architecture.
- [x] Add loop/validation scripts and guardrails.
- [x] Bootstrap TypeScript CLI workspace.
- [x] Add centralized TypeBox schemas and runtime config.
- [x] Implement core command runner and browser profile handling.
- [x] Implement `instagram auth login`.
- [x] Implement `instagram scrape comments --url ...`.
- [x] Implement `instagram scrape profiles --url ... --profile-slug ... --out-dir ... --json`.
- [x] Add lint/type/guardrail/test pipeline.
- [x] Add migration notes and usage docs.

## Verification
- `bash -n scripts/refactor-to-cli-loop.sh scripts/validate-cli-refactor.sh`
- `node tools/check-function-loc.mjs`
- `npm install`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `pi --no-extensions --no-skills --provider google -p --tools read,grep,find,ls,bash "Validate iteration 1 of docs/refactor-to-cli-plan.md ..."` → `APPROVED`
- `pi --no-extensions --no-skills --provider google -p --tools read,grep,find,ls,bash "Validate iteration 2 of docs/refactor-to-cli-plan.md ..."` → `APPROVED`
- `pi --no-extensions --no-skills --provider google -p --tools read,grep,find,ls,bash "Validate iteration 3 of docs/refactor-to-cli-plan.md ..."` → `APPROVED`
- `pi --no-extensions --no-skills --provider google -p --tools read,grep,find,ls,bash "Validate iteration 4 of docs/refactor-to-cli-plan.md ..."` → `APPROVED`

## Notes
- No push unless explicitly requested.
- Validate each phase with a read-only subagent plus local commands.
- Iteration 1 complete:
  - CLI spec + target architecture written in `docs/refactor-to-cli-plan.md`
  - loop/guardrail automation added in `scripts/refactor-to-cli-loop.sh`, `scripts/validate-cli-refactor.sh`, `tools/check-function-loc.mjs`
  - TypeScript workspace bootstrapped with `package.json`, `tsconfig.json`, `eslint.config.mjs`, and initial `cli/` command skeleton
  - validator subagent result: `APPROVED`
- Iteration 2 complete:
  - centralized schemas split into `cli/src/schemas/{commands,config,outputs,index}.ts`
  - core command parsing/runtime context added in `cli/src/core/{argv,context,app}.ts`
  - browser profile path handling and interactive `instagram auth login` flow added with storage state persistence scaffold
  - validator subagent result: `APPROVED`
- Iteration 3 complete:
  - `instagram scrape comments --url ...` implemented with artifact output (`comments.json`, `comments.png`)
  - `instagram scrape profiles --url ... --profile-slug ... --out-dir ... --json` implemented with profile json + screenshot output
  - TypeScript validation pipeline hardened: lint, strict typecheck, Vitest coverage, guardrails, and CI workflow coverage
  - validator subagent result: `APPROVED`
- Iteration 4 complete:
  - migration notes added in `docs/cli-migration.md`
  - CLI usage docs added in `docs/cli-usage.md`
  - repo-level documentation updated in `README.md` and `CHANGELOG.md`
  - validator subagent result: `APPROVED`
