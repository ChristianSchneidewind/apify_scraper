# Instagram CLI refactor plan

## 1. Target outcome

Refactor the current Python/Apify actor into a **TypeScript-only CLI** named `instagram` with:

- strict typing everywhere
- **TypeBox as the single schema/type source**
- a **tiny core + highly modular feature modules**
- no ad-hoc `type` / `interface` declarations spread across files
- architecture guardrails enforced automatically

Primary commands:

```bash
instagram auth login
instagram --browser-profile "default"
instagram scrape comments --url "..."
instagram scrape profiles --url "..." --profile-slug "..." --out-dir "..." --json
```

## 2. CLI spec

### Name
`instagram`

### One-liner
Instagram automation CLI for auth, comment scraping, and profile screenshot capture.

### Usage

```bash
instagram [global flags] <command> [subcommand] [flags]
```

### Global flags

| Flag | Type | Default | Purpose |
|---|---:|---:|---|
| `-h, --help` | boolean | `false` | Show help |
| `--version` | boolean | `false` | Print version |
| `--json` | boolean | `false` | Machine-readable output |
| `--no-color` | boolean | `false` | Disable ANSI color |
| `--quiet` | boolean | `false` | Minimal human output |
| `--verbose` | boolean | `false` | More diagnostics to stderr |
| `--browser-profile <name>` | string | `default` | Named persisted browser/session profile |
| `--cwd <path>` | string | current dir | Optional working directory override |
| `--no-input` | boolean | `false` | Disable prompts |
| `--dry-run` | boolean | `false` | Validate/plan without mutating state |

### Commands

#### `instagram auth login`
Authenticate against Instagram and persist browser/session state into the selected browser profile.

Flags:
- `--browser-profile <name>`
- `--headful`
- `--no-input`
- `--json`

#### `instagram scrape comments`
Scrape comments from a post/reel URL.

Flags:
- `--url <instagram-post-or-reel-url>` (required)
- `--browser-profile <name>`
- `--max-comments <n>`
- `--out-dir <path>`
- `--json`
- `--headful`

#### `instagram scrape profiles`
Open a profile URL, optionally override the output slug, and capture profile artifacts.

Flags:
- `--url <instagram-profile-url>` (required)
- `--profile-slug <slug>` (optional)
- `--out-dir <path>` (required for file output mode)
- `--browser-profile <name>`
- `--json`
- `--headful`

## 3. Output contract

### stdout
- primary command output only
- if `--json`: a single stable JSON object
- otherwise: concise human-readable success output

### stderr
- validation errors
- progress / diagnostics / warnings
- verbose logs when `--verbose`

### Exit codes
- `0` success
- `1` execution failure
- `2` invalid usage / validation failure
- `3` auth failure
- `4` browser startup failure
- `5` scrape failure

## 4. Type strategy

All schemas and derived static types must be centralized.

Proposed files:

```txt
src/
  schemas/
    index.ts            # TypeBox schemas + Static<typeof ...>
    commands.ts
    config.ts
    outputs.ts
  core/
    app.ts
    command-registry.ts
    run-command.ts
    cli-parser.ts
    context.ts
    result.ts
    errors.ts
  modules/
    auth/
    scrape-comments/
    scrape-profiles/
    browser/
    output/
  adapters/
    instagram/
    filesystem/
    playwright/
  guardrails/
    index.ts
```

Rules:
- TypeBox schemas live under `src/schemas/**`
- `Static<typeof Schema>` exports come only from schema files
- feature files import types only from centralized schema exports
- no local `interface`, `type`, or ambient DTO definitions in leaf modules

## 5. Architecture style

### Core must stay tiny

Core responsibilities only:
- parse CLI input
- validate config
- resolve command
- assemble execution context
- call module entrypoint
- normalize output / exit code

### Modules do the work

Modules own feature behavior:
- auth
- browser profile management
- comments scraping
- profiles scraping
- output formatting
- filesystem persistence

### Adapters isolate dependencies

Adapters wrap:
- Playwright
- filesystem
- Instagram selectors/flows
- JSON output rendering

That keeps the core close to pi coding agent style: **small orchestration layer, everything else modular**.

## 6. Guardrails

Required guardrails:

- max **250 LOC per file**
- max **45 LOC per function/method**
- max **indentation level 2**
- strict TypeScript mode
- no `any`
- no local `type` / `interface` declarations outside approved schema/type files
- no pushes from automation
- every phase must pass validator subagent review before continuing

## 7. Validation model

Each implementation phase has two gates:

1. **local deterministic validation**
   - lint
   - typecheck
   - tests
   - custom guardrail script

2. **subagent validation**
   - read-only review by a second `pi` run
   - checks compliance vs requirements
   - must return `APPROVED` before next phase

## 8. Refactor phases

### Phase 0 — spec + scaffolding
- add CLI spec docs
- add loop scripts
- add validation scripts
- add architecture guardrails

### Phase 1 — TS workspace bootstrap
- add `package.json`
- add `tsconfig.json`
- add lint setup
- add TypeBox dependency
- add command parser dependency

### Phase 2 — central schemas + config
- define all command/config/result schemas
- export static types centrally
- enforce imports from central schemas only

### Phase 3 — core runtime
- app bootstrap
- command registry
- parse/validate/dispatch pipeline
- stdout/stderr/json behavior

### Phase 4 — browser profile module
- named browser profile resolution
- persisted auth/session storage
- headful/headless handling

### Phase 5 — auth login
- `instagram auth login`
- deterministic result contract

### Phase 6 — scrape comments
- port comment scraping into modular TS adapters
- wire command handler

### Phase 7 — scrape profiles
- implement profile screenshot flow
- support `--profile-slug`, `--out-dir`, `--json`

### Phase 8 — hardening
- tests
- fixture coverage
- docs
- migration notes
- remove obsolete Python entry path when ready

## 9. Suggested dependencies

- `typebox`
- `tsx` or `ts-node` for dev execution
- `typescript`
- `eslint`
- `@typescript-eslint/parser`
- `@typescript-eslint/eslint-plugin`
- `commander` or `cac` (prefer `cac` for a smaller surface)
- `playwright`
- `vitest`

## 10. Immediate next step

Do **not** attempt a big-bang rewrite.

Start with:
1. loop scripts
2. guardrail validator
3. CLI spec lock-in
4. TS bootstrap

Then move phase by phase with subagent approval after each iteration.
