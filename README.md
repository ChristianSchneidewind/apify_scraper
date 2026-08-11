# Instagram CLI

TypeScript-only Instagram scraping CLI.

## Commands

- `instagram auth login`
- `instagram scrape comments --url ...`
- `instagram scrape profiles --url ... --profile-slug ... --out-dir ...`

## Features

- Instagram login with persisted browser profile
- Comment scraping via UI loop
- Likes + likers extraction
- Per-comment highlighted screenshots
- Multipart capture for long comments
- Profile scraping with JSON + screenshot output

## Setup

```bash
npm install
npx playwright install chromium
```

## Usage

```bash
npx tsx cli/src/bin/instagram.ts auth login --browser-profile "default"

npx tsx cli/src/bin/instagram.ts scrape comments \
  --url "https://www.instagram.com/p/abc/" \
  --out-dir "artifacts/comments"

# Resume an interrupted run from its checkpoint
npx tsx cli/src/bin/instagram.ts scrape comments \
  --url "https://www.instagram.com/p/abc/" \
  --resume "artifacts/comments/<run>/checkpoint.json" \
  --retry-incomplete-likers

npx tsx cli/src/bin/instagram.ts scrape profiles \
  --url "https://www.instagram.com/nasa/" \
  --profile-slug "nasa" \
  --out-dir "artifacts/profiles" \
  --json
```

Defaults:

- browser runs **headful** (visible UI); use `--headless` to override
- `--dry-run` validates the command without opening a browser or writing artifacts
- `--max-comments 0` = unlimited
- `--max-comment-likers 0` = all visible likers

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

- Instagram may expose only a subset of comments or likers.
- Liker dialogs can open before their contents are available; incomplete collections are marked in the output.
- UI selectors can require maintenance when Instagram changes its interface.
- The CLI uses the Instagram UI rather than a private API.

## License

MIT
