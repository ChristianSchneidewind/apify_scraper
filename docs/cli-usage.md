# Instagram CLI usage

## Development entrypoint

```bash
npx tsx cli/src/bin/instagram.ts <command>
```

## Output modes

- Default: concise human-readable output to stdout.
- `--json`: one JSON object to stdout.
- `--plain`: stable line-oriented text output (`OK|ERROR`, command, summary, sorted `key=value` details).
- Successful comment scrapes report `incompleteLikersCount` and `multipartCount` in details.
- `--headless`: deprecated no-op; CDP mode always uses the running Chrome UI.
- `--evidence`: write `actions.ndjson` plus a SHA-256 `manifest.json` per run.
- `--dry-run`: validate the command without opening a browser or writing artifacts.
- `--resume <path>`: continue from a previous comments `checkpoint.json`.
- liker-related flags are accepted for compatibility but currently do not collect profiles.
- Diagnostics, warnings, and validation errors go to stderr.
- `--no-input` disables prompts; auth login requires an interactive TTY.

## Commands

### CDP connection summary

Global options may appear before or after commands. This standalone lookup does not attach to Chrome:

```bash
npx tsx cli/src/bin/instagram.ts --cdp-url "http://127.0.0.1:9222" --json
```

### Login

```bash
npx tsx cli/src/bin/instagram.ts auth login
```

The command never automates the login itself: sign in manually in the
connected Chrome; the command verifies the resulting session state.

### Scrape comments

```bash
npx tsx cli/src/bin/instagram.ts scrape comments \
  --url "https://www.instagram.com/p/abc/" \
  --out-dir "artifacts/comments" \
  --max-comments 0 \
  --max-ui-rounds 40 \
  --ui-idle-rounds 6
```

Each processed comment is checkpointed to `checkpoint.json` in the run directory. Resume an interrupted run with:

```bash
npx tsx cli/src/bin/instagram.ts scrape comments \
  --url "https://www.instagram.com/p/abc/" \
  --resume "artifacts/comments/<run>/checkpoint.json"
```

`--max-comments 0` means no limit. Liker-related options are currently inactive.

### Scrape profiles

```bash
npx tsx cli/src/bin/instagram.ts scrape profiles \
  --url "https://www.instagram.com/nasa/" \
  --profile-slug "nasa" \
  --out-dir "artifacts/profiles" \
  --json
```

## Versioning and release

The CLI version is `0.1.0` and is exposed through `--version`. Releases are created from version tags using the repository release workflow.

## Validation commands

```bash
npm run lint
npm run typecheck
npm run test:coverage
CI=1 npm run guardrails
```

## Guardrails

- max 250 LOC per file
- max 45 LOC per function/method
- max indentation depth 2
- strict TypeScript mode required
- no `any`
- no local `type` / `interface` outside centralized schema files

## Refactor status

The TypeScript CLI is now the only runtime in this repository.

Ported and usable:

- Visible like-count extraction; liker-profile dialog collection remains disabled
- Screenshots with red outline per comment
- Multipart capture for long comments
- UI tuning (`--max-ui-rounds`, `--ui-idle-rounds`)

The CLI writes local artifacts under `--out-dir`.
