# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by Keep a Changelog and follows semantic versioning in spirit.

## [Unreleased]

### Added
- Structured logging events (`log_event`, `warn_event`) in core flow.
- Improved liker collection robustness for unlimited mode (`maxCommentLikers=0`).
- Push-only CI workflow for tests.
- Additional unit/smoke test coverage across core modules.
- Versioned actor output schema files:
  - `.actor/dataset_schema.json`
  - `.actor/output_schema.json`
- Typed scraper exceptions (`InputValidationError`, `LoginError`, etc.).
- Per-comment performance metrics and end-of-run summary event.
- TypeScript CLI workspace under `cli/` with centralized TypeBox schemas.
- CLI guardrail scripts and iterative refactor loop tooling.
- TypeScript CLI comment scrape loop with Instagram DOM selectors and structured JSON output.

### Changed
- Split runtime and development dependencies (`requirements.txt` + `requirements-dev.txt`).
- CI now covers both Python checks and TypeScript CLI checks.

## [1.0.0] - 2026-06-01

### Added
- Initial actor implementation for Instagram comment capture with screenshots.
