# Instagram Comment Scraper (Apify Actor, Python)

Ein selbstgehosteter **Apify Actor** in Python, der Instagram-Kommentare im UI-Modus sammelt und pro Kommentar Screenshots mit **roter Hervorhebung** erzeugt.

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
├── main.py
├── INPUT_SCHEMA.json
├── requirements.txt
├── src/
│   ├── scrape_loop.py
│   ├── comments.py
│   ├── comment_likers.py
│   ├── multipart_executor.py
│   ├── page_setup.py
│   └── ...
├── tests/
└── storage/
```

---

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install
```

Für Entwicklung/Tests:

```bash
pip install -r requirements-dev.txt
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

```bash
python3 -m main
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

```bash
.venv/bin/pytest -q
# optional mit Coverage:
.venv/bin/pytest -q --cov=src --cov-report=term-missing
```

CI läuft bei Push über GitHub Actions:

```txt
.github/workflows/tests-on-push.yml
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
  --runs 3 \
  --max-comments 20 \
  --python .venv/bin/python
```

Der Runner schreibt das Input nach `storage/key_value_stores/default/INPUT.json`, startet mehrere Läufe und extrahiert `run.summary`-Metriken.

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

---

## Lizenz

Dieses Projekt steht unter der **MIT License**.
Siehe [`LICENSE`](./LICENSE).
