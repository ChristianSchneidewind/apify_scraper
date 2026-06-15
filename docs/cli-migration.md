# CLI migration notes

This project is being refactored from a Python Apify actor into a TypeScript CLI.

## Old entrypoint

```bash
python3 -m main
```

## New entrypoint

```bash
npx tsx cli/src/bin/instagram.ts <command>
```

After packaging, the intended command name is:

```bash
instagram <command>
```

## Command mapping

### Login

Old:
- implicit actor login/session handling during scraping

New:

```bash
instagram auth login --browser-profile "default"
```

Use `--no-input` to disable prompts; login requires an interactive terminal.

### Scrape comments

Old:
- configure `storage/key_value_stores/default/INPUT.json`
- run `python3 -m main`

New:

```bash
instagram scrape comments --url "https://www.instagram.com/p/.../"
```

### Scrape profiles

New:

```bash
instagram scrape profiles \
  --url "https://www.instagram.com/username/" \
  --profile-slug "username" \
  --out-dir "artifacts/profiles" \
  --json
```

## Storage migration

### Old actor-oriented storage
- Apify dataset
- Apify KV store
- local `Screenshots/`
- local `storage/`

### New CLI-oriented storage
- browser/session state under:
  - `.instagram-cli/profiles/<profile-name>/storage-state.json`
- command artifacts under explicit output directories

## Output migration

### Old
- actor dataset items
- actor output schemas
- run summaries in actor storage/KV

### New
- stdout for human output
- `--json` for machine-readable output
- `--plain` for stable line-oriented output
- JSON artifact files in explicit output directories
- screenshots written beside related JSON artifacts

## Behavioral differences

- The new CLI is human-first but scriptable.
- Flags replace most actor input JSON configuration.
- Named browser profiles are explicit via `--browser-profile`.
- Validation and architecture guardrails are enforced in the TypeScript workspace.

### Python Parity (Phase 9 — done)

**Python Parity** means feature parity between the Python actor and the TypeScript CLI.
Phase 9 is complete and validated (`scripts/refactor-cli-phase-validator.sh 9` → APPROVED).

| Capability | Python actor | TypeScript CLI |
|---|---|---|
| Comment scraping (UI loop) | yes | yes |
| Profile scraping | — | yes |
| Likers extraction | yes | yes (default: all visible likers; optional `--max-comment-likers`) |
| Per-comment screenshots with red outline | yes | yes |
| Multipart capture for long comments | yes | yes |
| Apify dataset / KV store output | yes | no (local artifacts) |

Use `python3 -m main` only when Apify dataset/KV integration is required.

## Current status

Implemented in the CLI workspace:
- `instagram auth login`
- `instagram scrape comments --url ...`
- `instagram scrape profiles --url ... --profile-slug ... --out-dir ... --json`

Still to decide later:
- final packaging/distribution format
- retirement timing for the Python actor entrypoint
- whether actor-compatible export adapters remain necessary
