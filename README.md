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

## Docs

- `docs/architecture.md`
- `docs/cli-usage.md`
- `docs/troubleshooting.md`
- `docs/refactor-to-cli-status.md`

## License

MIT
