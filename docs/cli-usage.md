# Instagram CLI usage

## Development entrypoint

```bash
npx tsx cli/src/bin/instagram.ts <command>
```

## Output modes

- Default: concise human-readable output to stdout.
- `--json`: one JSON object to stdout.
- `--plain`: stable line-oriented text output (`OK|ERROR`, command, summary, sorted `key=value` details).
- `--headless`: run browser without visible UI (default is headful).
- Diagnostics, warnings, and validation errors go to stderr.
- `--no-input` disables prompts; auth login requires an interactive TTY.

## Commands

### Login

```bash
npx tsx cli/src/bin/instagram.ts auth login \
  --browser-profile "default"
```

### Scrape comments

```bash
npx tsx cli/src/bin/instagram.ts scrape comments \
  --url "https://www.instagram.com/p/abc/" \
  --out-dir "artifacts/comments" \
  --max-comments 0 \
  --max-ui-rounds 40 \
  --ui-idle-rounds 6
```

Default: `--max-comment-likers 0` = all visible likers. `--max-comments 0` = no limit.

### Scrape profiles

```bash
npx tsx cli/src/bin/instagram.ts scrape profiles \
  --url "https://www.instagram.com/nasa/" \
  --profile-slug "nasa" \
  --out-dir "artifacts/profiles" \
  --json
```

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

- Likers extraction (`--max-comment-likers`, `--liker-collection-mode`)
- Screenshots with red outline per comment
- Multipart capture for long comments
- UI tuning (`--max-ui-rounds`, `--ui-idle-rounds`)

The CLI writes local artifacts under `--out-dir`.
