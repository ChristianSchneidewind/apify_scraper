# CLI Refactor — Ist-Stand

Stand: automatisch gepflegt gegen Repo-Checks (`scripts/refactor-cli-phase-detect.sh`).

## Ziel

TypeScript-only CLI `instagram` mit **1:1-Parität** zum Python-Actor:

- kleinem Core (`cli/src/core/**`)
- modularen Features (`cli/src/modules/**`)
- Adaptern (`cli/src/adapters/**`)
- zentralen TypeBox-Schemas (`cli/src/schemas/**`)
- Guardrails: max 250 LOC/Datei, max 45 LOC/Funktion, max Indent-Tiefe 2

## CLI-Befehle (Soll)

```bash
instagram auth login
instagram --browser-profile "default"
instagram scrape comments --url "..."
instagram scrape profiles --url "..." --profile-slug "..." --out-dir "..." --json
```

## Phasen-Status

| Phase | Name | Status | Validator |
|---:|---|---|---|
| 1 | spec-and-guardrails | **DONE** | APPROVED |
| 2 | ts-workspace-bootstrap | **DONE** | APPROVED |
| 3 | central-schemas | **DONE** | APPROVED |
| 4 | core-runtime | **DONE** | APPROVED |
| 5 | browser-profile-and-auth | **DONE** | APPROVED |
| 6 | scrape-comments-port | **DONE** | APPROVED |
| 7 | scrape-profiles-port | **DONE** | APPROVED |
| 8 | hardening-and-migration | **DONE** | APPROVED |
| 9 | python-parity-likers-highlight-multipart | **DONE** | APPROVED |

**Nächste Phase:** — (alle 9 Phasen abgeschlossen)

## Was bereits umgesetzt ist

### Infrastruktur
- `package.json`, `tsconfig.json` (strict), `eslint.config.mjs`
- Guardrails: `scripts/validate-cli-refactor.sh`
- Loop: `scripts/refactor-to-cli-loop.sh`
- Phasen-Detektion: `scripts/refactor-cli-phase-detect.sh`
- Phasen-Validator: `scripts/refactor-cli-phase-validator.sh`

### Core + Schemas
- TypeBox-Schemas in `cli/src/schemas/{commands,config,outputs}.ts`
- Core: `app.ts`, `argv.ts`, `context.ts`, `result.ts`
- Entry: `cli/src/bin/instagram.ts`

### Module (MVP)
- Auth: interaktiver Login + `storage-state.json` pro Browser-Profil
- Scrape comments: UI-Round-Loop mit DOM-Selektoren, Expand/Scroll, strukturierte Extraktion
- Scrape profiles: Profil-Extraktion (Browser-Script), Screenshot, JSON/PNG-Artefakte

### Tests
- Vitest-Tests, alle grün
- Coverage ~69 % (UI-Expand/Scroll-Adapter teils ungetestet)

## Python Parität — Phase 9 (abgeschlossen)

**Ziel:** Vollständiger Feature-Gleichstand zwischen Python-Actor und TypeScript-CLI.
Validator: `SKIP_PI=1 CI=1 bash scripts/refactor-to-cli-loop.sh validate 9` → **APPROVED**.

| Feature | Python Actor | TypeScript CLI |
|---|---|---|
| Kommentar-UI-Loop | ja | ja |
| Profile scrapen | — | ja |
| Likers-Extraktion | ja | ja (Default: alle sichtbaren Likers; optional `--max-comment-likers`) |
| Screenshots mit Highlighting | ja | ja (rote Outline pro Kommentar) |
| Multipart-Capture | ja | ja (Scroll + 3plus-Route) |
| Apify Dataset / KV-Store | ja | nein (lokale Artefakte unter `--out-dir`) |

Port-Reihenfolge und TS-Zielpfade:

| Python | TS-Ziel |
|---|---|
| `comment_likers.py` | `modules/scrape-comments/likers/` |
| `highlighting.py`, `screenshots.py` (highlight) | `adapters/instagram/highlight.ts` |
| `multipart_planner.py`, `multipart_executor.py` | `modules/scrape-comments/multipart/` |
| `comment_capture_pipeline.py` | `modules/scrape-comments/capture/` |

## Phase 9 — umgesetzt

| Python | TS |
|---|---|
| `comment_likers.py` | `modules/scrape-comments/likers/` (`enrich.ts`, `open-inline.ts`, `open-deep.ts`, `collect-dialog.ts`) |
| `highlighting.py` | `adapters/instagram/highlight.ts` |
| `multipart_planner.py`, `multipart_executor.py` | `modules/scrape-comments/multipart/` + `capture/assets.ts` |
| `comment_capture_pipeline.py` | `modules/scrape-comments/process-comment.ts` + `capture/` |
| `scrape_loop.py` (Kern-Loop) | `modules/scrape-comments/scrape-loop.ts` |
| `instagram_dom.py`, `dom_selectors.py` | `adapters/instagram/dom-selectors.ts` |
| Zeit-Knoten-Extraktion | `modules/scrape-comments/extract-times.ts` + Browser-Script |

Tests: `highlight.test.ts`, `likers-enrich.test.ts`, `multipart-decisions.test.ts`, `process-comment.test.ts`

## Phase 7 — umgesetzt

| Ziel | Datei |
|---|---|
| Profil-Capture-Logik | `modules/scrape-profiles/capture.ts` |
| Browser-Script | `modules/scrape-profiles/browser-scripts/extract-profile.script` |
| Artefakt-Schreiben | slug + out-dir + json/png via `persistProfileArtifacts` |

## Phase 8 — umgesetzt

- Migration + Usage-Docs: `docs/cli-migration.md`, `docs/cli-usage.md`
- CI: TypeScript-Checks in `.github/workflows/tests-on-push.yml`

## Loop ausführen

```bash
# Ist-Stand anzeigen
bash scripts/refactor-to-cli-loop.sh status

# State aus Repo erkennen
bash scripts/refactor-to-cli-loop.sh init-state

# Nur Guardrails
CI=1 bash scripts/refactor-to-cli-loop.sh guardrails

# Nächste Phase (mit pi-Subagent, falls verfügbar)
bash scripts/refactor-to-cli-loop.sh run

# Alle offenen Phasen
bash scripts/refactor-to-cli-loop.sh run-all

# Ohne pi: manuell implementieren, dann validieren
SKIP_PI=1 bash scripts/refactor-to-cli-loop.sh validate 9
```

## Architektur (pi-Style)

```txt
cli/src/
  bin/instagram.ts          # Entry
  core/                     # klein: parse → validate → dispatch → result
  schemas/                  # einzige Quelle für Types
  modules/                  # Feature-Logik
  adapters/                 # Playwright, FS, Instagram DOM
```
