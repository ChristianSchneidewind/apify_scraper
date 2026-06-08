# Instagram CLI usage

## Development entrypoint

```bash
npx tsx cli/src/bin/instagram.ts <command>
```

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
  --out-dir "artifacts/comments"
```

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
