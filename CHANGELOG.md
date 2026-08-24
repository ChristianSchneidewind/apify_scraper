# Changelog

## [Unreleased]

### Added
- TypeScript-only Instagram CLI for authentication, comment scraping, and profile scraping.
- Persistent browser profiles for reusable Instagram sessions.
- Structured CLI output with JSON, plain-text, and typed error codes.
- Dry-run mode that validates commands without opening a browser.
- Central logger with quiet, verbose, and structured diagnostic output.
- Highlighted screenshots and multipart capture for long comments.
- Visible comment-like counts; liker-profile collector code remains dormant.
- Browser lifecycle cleanup and integration tests for failure paths.
- Explicit expired-session detection with actionable `auth login` guidance.
- Per-comment checkpoints and `--resume` support for interrupted comment runs.
- Liker-related CLI flags retained as compatibility placeholders.

### Changed
- Removed obsolete username/password `.env` configuration documentation.
- The CLI is now the only supported runtime.
- Liker-profile collection is intentionally disabled until the Instagram dialog flow is reliable.

## [0.1.0] - 2026-08-11

### Added
- Explicit liker completeness metadata and run summary metrics.
- `--retry-incomplete-likers` for delayed or unavailable liker dialogs.

## [1.0.0] - 2026-06-01

### Added
- Initial Instagram comment capture implementation.
