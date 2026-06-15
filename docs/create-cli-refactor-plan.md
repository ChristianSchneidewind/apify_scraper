# Instagram CLI refactor plan

Rubric: use the `create-cli` skill plus the condensed CLI guidelines as the UX contract.

## 1) Target outcome

Refactor the Python/Apify actor into a **TypeScript-only CLI** named `instagram`.

Non-negotiables:
- strict TypeScript
- TypeBox as the single schema/type source
- no local `type` / `interface` declarations in leaf files
- tiny core, highly modular feature modules
- adapters around Playwright, filesystem, and Instagram DOM flows
- no `any`
- no exceptions to the architecture rules

## 2) CLI surface

### Commands

```bash
instagram auth login
instagram --browser-profile "default"
instagram scrape comments --url "..."
instagram scrape profiles --url "..." --profile-slug "..." --out-dir "..." --json
```

### Global flags
- `-h, --help`
- `--version`
- `--json`
- `--plain`
- `--quiet`
- `--verbose`
- `--no-color`
- `--no-input`
- `--dry-run`
- `--browser-profile <name>`
- `--cwd <path>`

### I/O contract
- stdout: primary result only
- stderr: diagnostics, progress, warnings, validation errors
- JSON mode: one stable JSON object
- plain mode: stable line-oriented text

### Exit codes
- `0` success
- `1` execution failure
- `2` invalid usage / validation failure
- `3` auth failure
- `4` browser startup failure
- `5` scrape failure

## 3) Architecture

### Core
Keep `cli/src/core/**` tiny:
- parse argv
- validate request
- resolve command
- build runtime context
- dispatch to a module
- normalize output + exit code

### Modules
Feature logic lives in `cli/src/modules/**`:
- auth
- browser profile management
- comments scraping
- profiles scraping
- output assembly
- persistence

### Adapters
Isolation layer for dependencies:
- Playwright
- filesystem
- Instagram selectors / browser scripts
- JSON/text rendering

## 4) Type strategy

TypeBox is the only centralized source of:
- command schemas
- config schemas
- output schemas
- derived static types

Rules:
- schemas live only in `cli/src/schemas/**`
- `Static<typeof ...>` exports come only from schema files
- leaf modules import types from centralized schema exports only
- no local DTO types/interfaces in feature files

## 5) Guardrails

Required checks:
- max 250 LOC per file
- max 45 LOC per function/method
- max indentation depth 2
- strict TypeScript mode
- no `any`
- no local `type` / `interface` declarations outside schema files
- no push/publish from automation

## 6) Refactor phases

### Phase 0 — spec + guardrails
- document CLI contract
- add loop + validator scripts
- add measurable guardrails

### Phase 1 — TS workspace bootstrap
- package/tooling setup
- TypeBox + parser deps
- strict tsconfig + lint rules

### Phase 2 — centralized schemas
- command/config/output schemas
- exported static types
- request validation

### Phase 3 — tiny core runtime
- app bootstrap
- parse/validate/dispatch
- stdout/stderr/json/plain behavior
- exit-code mapping

### Phase 4 — browser profile + auth
- persisted browser profiles
- login state handling
- `instagram auth login`

### Phase 5 — scrape comments
- comment loop
- likers/highlight/multipart parity
- module wiring

### Phase 6 — scrape profiles
- profile capture
- slug/out-dir/json output

### Phase 7 — hardening
- tests
- docs
- migration notes
- remove obsolete Python entry path when safe

## 7) Validation model

Every phase requires two gates:
1. deterministic local checks
   - lint
   - typecheck
   - tests
   - guardrails
2. read-only subagent review
   - must return exactly `APPROVED`
   - otherwise the phase is blocked

## 8) Loop policy

The loop must:
- implement one phase at a time
- run guardrails after each phase
- run a read-only subagent review after each phase
- only advance when the reviewer approves
- keep changes phase-scoped

If the repo is already ahead of the plan, the loop should detect the current phase and continue from there.
