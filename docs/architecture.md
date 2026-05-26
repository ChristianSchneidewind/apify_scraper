# Architecture Overview

## Runtime Flow

1. `main.py` initializes actor/crawler and input config.
2. `scrape_loop.py` drives UI rounds and candidate extraction.
3. `comment_processor.py` (wrapper) delegates to `comment_capture_pipeline.py`.
4. `comment_capture_pipeline.py` orchestrates:
   - candidate dedup/state checks
   - visual preparation/highlight
   - liker enrichment
   - multipart planning/execution
   - payload persistence

## Module Responsibilities

- `comment_state.py`  
  Dedup keys, seen-sets, counters, candidate registration.

- `comment_text.py`  
  Comment URL/context helpers, lightweight text/log helpers.

- `comment_visual_helpers.py`  
  Visual/UI actions (expand, highlight readiness, geometry risk checks, highlight failure handling).

- `multipart_planner.py`  
  Multipart planning decisions (`mode`, `parts`, route selection).

- `multipart_executor.py`  
  Multipart execution loop, screenshot capture per part, fallback execution, metadata write trigger.

- `screenshots.py`  
  Screenshot persistence primitives, UUID/session creation, 3+ part low-level capture.

- `payloads.py`  
  Dataset + metadata payload assembly.

- `comment_pipeline_helpers.py`  
  Pipeline-specific helper glue (liker normalization + persist wrapper).

- `instagram_dom.py`  
  Centralized Instagram selector constants.

- `config.py`  
  Input parsing, clamping, coercion.

- `flow_utils.py` / `log_events.py` / `tuning.py`  
  Cross-cutting utilities (wait/suppress, structured event logs, tuning constants).

## Extension Points

- Add new extraction heuristics in `comments.py` and share selectors via `instagram_dom.py`.
- Adjust multipart behavior in `multipart_planner.py` first, then executor.
- Keep `comment_capture_pipeline.py` thin; move implementation details into focused modules.
