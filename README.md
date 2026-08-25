# Instagram CLI

TypeScript-only Instagram scraping CLI. It drives the user's own Chrome over
the Chrome DevTools Protocol (CDP) — no Playwright, no bundled browser.

## Commands

- `instagram auth login`
- `instagram scrape comments --url ...`
- `instagram scrape profiles --url ... --profile-slug ... --out-dir ...`
- `instagram scrape reposts --url ... --out-dir ...`

## Features

- Uses the real Chrome profile: existing Instagram login, cookies, fingerprint
- Comment scraping via UI loop with an action-verify loop and a per-run visibility quote
- Visible comment-like counts (liker-profile collection is temporarily disabled)
- Per-comment highlighted screenshots
- Multipart capture for long comments
- Profile scraping with JSON + timestamped screenshot folders and provenance banners
- Repost scraping with per-profile screenshot folders
- Optional evidence log (NDJSON actions + SHA-256 manifest) via `--evidence`

## Setup

```bash
npm install
```

Start your Chrome with remote debugging via the dedicated scraping profile:

```bash
scripts/chrome-cdp.sh
```

Chrome >= 136 ignores `--remote-debugging-port` for the default data
directory, so the script launches Chrome with a separate profile
(`~/.chrome-cdp`). Sign in to Instagram once there; the session persists.

## Usage

```bash
npx tsx cli/src/bin/instagram.ts auth login

npx tsx cli/src/bin/instagram.ts scrape comments \
  --url "https://www.instagram.com/p/abc/" \
  --out-dir "artifacts/comments"

# Resume an interrupted run from its checkpoint
npx tsx cli/src/bin/instagram.ts scrape comments \
  --url "https://www.instagram.com/p/abc/" \
  --resume "artifacts/comments/<run>/checkpoint.json"

npx tsx cli/src/bin/instagram.ts scrape profiles \
  --url "https://www.instagram.com/nasa/" \
  --profile-slug "nasa" \
  --out-dir "artifacts/profiles" \
  --json

npx tsx cli/src/bin/instagram.ts scrape reposts \
  --url "https://www.instagram.com/nasa/" \
  --out-dir "artifacts/reposts"
```

Defaults:

- the CLI drives the **visible** running Chrome UI; `--headless` is a deprecated no-op in CDP mode
- `--dry-run` validates the command without opening a browser or writing artifacts
- `--max-comments 0` = unlimited
- liker-related flags are retained for compatibility but currently have no effect

## Output modes

- default: concise human-readable stdout
- `--json`: single JSON object
- `--plain`: stable line-oriented output
- diagnostics/warnings/errors: stderr

## Validation

```bash
npm run lint
npm run typecheck
npm run test:coverage
CI=1 npm run guardrails
```

## Structure

```txt
.
├── cli/
│   ├── src/
│   └── tests/
├── docs/
├── scripts/
└── package.json
```

## Documentation

- [`docs/getting-started.md`](docs/getting-started.md) — setup and first run
- [`docs/cli-options.md`](docs/cli-options.md) — complete option reference
- [`docs/output-format.md`](docs/output-format.md) — JSON fields and artifacts
- [`docs/cli-usage.md`](docs/cli-usage.md) — command usage and validation
- [`docs/troubleshooting.md`](docs/troubleshooting.md) — common problems
- [`docs/architecture.md`](docs/architecture.md) — technical architecture

## Known limitations

- Instagram may expose only a subset of comments.
- Liker-profile collection is intentionally disabled until its UI flow is reliable; records use `likersReason: "liker_collection_disabled"`.
- UI selectors can require maintenance when Instagram changes its interface.
- The CLI uses the Instagram UI rather than a private API.

## License

MIT
