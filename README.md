# Instagram Comment Scraper / Instagram CLI

Dieses Repository befindet sich in einer Übergangsphase und enthält aktuell zwei Implementierungen:

- den bestehenden **Python Apify Actor**
- den neuen **TypeScript CLI-Refactor** unter `cli/`

Der Zielzustand ist eine **TypeScript-only CLI** mit kleiner Core-Architektur, modularen Feature-Modulen und zentralen **TypeBox**-Schemas.

## Current status

### Legacy runtime
- Python Apify Actor bleibt im Repository erhalten
- bestehende Actor-Dateien liegen weiter unter `main.py`, `src/`, `.actor/`

### New CLI runtime
- neue CLI liegt unter `cli/`
- derzeit implementierte Befehle:
  - `instagram auth login`
  - `instagram scrape comments --url ...`
  - `instagram scrape profiles --url ... --profile-slug ... --out-dir ... --json`
- Validierung läuft über:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:coverage`
  - `CI=1 npm run guardrails`

## Features

- Scraping von Kommentaren über Playwright (robuster UI-Flow)
- Optionaler Login für bessere Kommentar-Abdeckung
- Persistenter Login-State (`LOGIN_STATE`) im Key-Value-Store
- Pro Kommentar:
  - Extraktion von Text, User, Timestamp, Likes, ggf. Likers
  - Screenshot mit roter Outline
  - Multipart-Capture für lange Kommentare
- Speicherung in:
  - **Apify Dataset** (strukturierte Daten)
  - **Screenshots/** (lokale Bilddateien)

---

## Tech Stack

```txt
Python 3.12
apify
crawlee
playwright
python-dotenv
```

---

## Projektstruktur

```txt
.
├── cli/
│   ├── src/
│   │   ├── adapters/
│   │   ├── core/
│   │   ├── modules/
│   │   └── schemas/
│   └── tests/
├── main.py
├── INPUT_SCHEMA.json
├── requirements.txt
├── src/
├── tests/
├── docs/
└── storage/
```

---

## Setup

### Python actor

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install
```

Für Python-Entwicklung/Tests:

```bash
pip install -r requirements-dev.txt
```

### TypeScript CLI

```bash
npm install
npx playwright install chromium
```

Optional `.env`:

```env
INSTAGRAM_USERNAME=dein_username
INSTAGRAM_PASSWORD=dein_passwort
LIKERS_DEBUG_INLINE=0
LIKERS_DEBUG_PROGRESS=0
```

---

## Lokaler Start

### Python actor

```bash
python3 -m main
```

### TypeScript CLI

```bash
npx tsx cli/src/bin/instagram.ts auth login --browser-profile "default"
npx tsx cli/src/bin/instagram.ts scrape comments --url "https://www.instagram.com/p/abc/"
npx tsx cli/src/bin/instagram.ts scrape profiles --url "https://www.instagram.com/nasa/" --profile-slug "nasa" --out-dir "artifacts/profiles" --json
```

Input liegt typischerweise unter:

```txt
storage/key_value_stores/default/INPUT.json
```

Beispiel:

```json
{
  "urls": ["https://www.instagram.com/p/DWHWE2vDbdr/"],
  "maxComments": 0,
  "loginEnabled": true,
  "maxCommentLikers": 0,
  "headful": false,
  "maxUiRounds": 120,
  "uiIdleRounds": 15
}
```

> `maxCommentLikers: 0` = versuche alle sichtbaren Likers zu sammeln.

---

## Feature Flags / Debug

Umfangreiche Laufzeit-Optionen kommen über `INPUT.json` (siehe `INPUT_SCHEMA.json`).
Zusätzliche Debug-Flags laufen über Umgebungsvariablen:

- `LIKERS_DEBUG_INLINE=1` → detailliertes Inline-Debugging für Like-Button-Erkennung
- `LIKERS_DEBUG_PROGRESS=1` → Progress-/Stop-Gründe beim Einsammeln der Likers pro Runde

Beispiel:

```bash
LIKERS_DEBUG_PROGRESS=1 python3 -m main
```

---

## Tests

Python-Actor:

```bash
.venv/bin/pytest -q
# optional mit Coverage:
.venv/bin/pytest -q --cov=src --cov-report=term-missing
```

TypeScript CLI:

```bash
npm run lint
npm run typecheck
npm run test:coverage
CI=1 npm run guardrails
```

CI läuft bei Push über GitHub Actions:

```txt
.github/workflows/tests-on-push.yml
```

Optionaler manueller Performance-Guardrail:

```txt
.github/workflows/perf-guardrail.yml
```

Output-Schemata:

```txt
.actor/dataset_schema.json
.actor/output_schema.json
```

---

## Wichtige Module

`main.py` (Orchestrierung):

```python
async with Actor:
    input_data = await Actor.get_input() or {}
    cfg = parse_input(input_data)
    crawler = PlaywrightCrawler(...)
    await crawler.run(urls)
```

`src/scrape_loop.py` (UI-Runden + Rescan):

```python
for round_idx in range(max_ui_rounds):
    await expand_comments(page, 30)
    # extract + capture
    if idle >= ui_idle_rounds:
        break
```

`src/multipart_executor.py` (Multipart-Screenshots):

```python
if use_3plus_route:
    await run_3plus_fallback_with_context(...)
```

---

## CLI refactor docs

- [`docs/refactor-to-cli-plan.md`](./docs/refactor-to-cli-plan.md)
- [`docs/cli-usage.md`](./docs/cli-usage.md)
- [`docs/cli-migration.md`](./docs/cli-migration.md)

## Troubleshooting

Siehe [`docs/troubleshooting.md`](./docs/troubleshooting.md).

## Bekannte Grenzen

- Instagram kann sichtbare Kommentare/Like-Dialoge limitieren.
- UI/DOM kann sich ändern; Selektoren müssen ggf. nachgezogen werden.
- „Alle Likers“ bedeutet: alle **sichtbar ladbaren** Likers, nicht garantiert alle global.

---

## Benchmark (lokal)

Für reproduzierbare lokale Laufzeitmessungen:

```bash
python3 tools/benchmark_runner.py \
  --url "https://www.instagram.com/p/DWHWE2vDbdr/" \
  --warmup-runs 1 \
  --runs 3 \
  --max-comments 20 \
  --max-ui-rounds 120 \
  --ui-idle-rounds 15 \
  --login-enabled \
  --python .venv/bin/python \
  --out storage/benchmarks/latest.json
```

Der Runner schreibt das Input nach `storage/key_value_stores/default/INPUT.json`, startet mehrere Läufe und extrahiert `run.summary`-Metriken.
Er markiert Läufe als `valid=false`, wenn `urls_processed < urls_total`, und berechnet Durchschnitt/Median nur aus validen gemessenen Runs.

## Release-Prozess

Für nachvollziehbare Stände nutzen wir:

- `CHANGELOG.md` für Änderungen pro Release
- Git Tags für stabile Versionen

Beispiel:

```bash
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin v1.1.0
```

Empfehlung:

1. PRs nach `main` mergen
2. `CHANGELOG.md` unter `Unreleased` pflegen
3. vor Release `Unreleased` in Versionsblock überführen
4. Tag setzen und pushen

Release-Workflow testen (RC):

1. RC-Tag erstellen und pushen (z. B. `v1.1.0-rc1`)
2. In GitHub Actions `Release on tag` per `Run workflow` starten
3. `tag_name=v1.1.0-rc1` und `prerelease=true` setzen

---

## Lizenz

Dieses Projekt steht unter der **MIT License**.
Siehe [`LICENSE`](./LICENSE).
