# Troubleshooting Playbook

## 1) `comments_captured_total=0`

Prüfen:
- Ist `loginEnabled=true` gesetzt?
- Sind gültige Instagram-URLs im Input (`https://www.instagram.com/...`)?
- Gibt es Login-Walls oder UI-Blocker?

Empfehlung:
- `runtimeProfile: "deep"`
- `maxUiRounds` hochsetzen (z. B. 120)
- `uiIdleRounds` hochsetzen (z. B. 15)

---

## 2) Likers deutlich unter `likesCount`

Hinweise:
- Instagram UI liefert oft nur „sichtbar ladbare“ Likers.
- `maxCommentLikers: 0` entfernt nur den lokalen Cap.

Empfehlung:
- `likerCollectionMode: "strict"`
- `LIKERS_DEBUG_PROGRESS=1` aktivieren
- Logs auf `strict_incomplete` prüfen

---

## 3) Sehr langsame Runs

Typische Ursache:
- Ausklappen/Scrollen der Kommentare dominiert Laufzeit.

Empfehlung:
- Für Geschwindigkeit `runtimeProfile: "fast"`
- Für Benchmark bewusst `maxComments` begrenzen
- Benchmark-Runner mit `--warmup-runs` nutzen

---

## 4) CI-Fehler bei Workflow/Schema/Lint

- `tests-on-push.yml` erwartet:
  - Schema-Validator
  - Ruff-Lint
  - Pytest-Coverage
- Prüfen:
  - `.actor/dataset_schema.json`
  - `.actor/output_schema.json`
  - `.github/scripts/validate_actor_schemas.py`

---

## 5) Release-Workflow

- Auto-Release bei Tag `v*`
- RC-Test per `workflow_dispatch` mit:
  - `tag_name=vX.Y.Z-rc1`
  - `prerelease=true`
