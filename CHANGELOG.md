# Changelog

## [Unreleased]

### Added
- Direct CDP browser automation against the user's running Chrome (`--cdp-url`), replacing Playwright: real profile, existing logins, no browser download.
- `scripts/chrome-cdp.sh`: idempotent launcher for Chrome with remote debugging in a dedicated scraping profile (`~/.chrome-cdp`); required because Chrome >= 136 ignores the debug port for the default data directory.
- Action-verify capture loop: viewport visibility is verified before screenshots, outliers are flagged instead of dropped, and each run ends with a visibility quote.
- `--evidence` flag writing `actions.ndjson` and a SHA-256 `manifest.json` per run directory.
- CDP integration test fixture that launches the system Chrome headless.
- Review flagging for incomplete captures: `multipartNeedsReview` + `multipartFlagReason` mark comments whose saved parts fall short of the plan (verify failures, capture fallbacks); deduplicated scroll-no-op parts count as covered.
- Automatic row refind and part retry when Instagram detaches a comment row between multipart screenshots; captions and pinned comments without a `/c/` permalink are refound via author anchor plus text prefix.

### Changed
- `auth login` no longer persists storage state; it verifies the session in the connected Chrome (logins are never automated).
- `--browser-profile` was replaced by `--cdp-url`; `--headless` is a deprecated no-op.
- Playwright dependency removed; the Docker image is a plain Node runtime that expects an external Chrome endpoint.
- Comment highlight and multipart planning now resolve the full comment row (avatar and likes row included) instead of the bare text block; the red frame is re-applied before every part screenshot, and the overlay is clamped to the comment scrollport.

### Fixed
- Multipart clips follow the actual scrollport and reach the comment end (likes row) on the final part; single captures escalate on top clipping as well.
- Multipart is only planned when content actually overflows the visible strip, removing redundant near-duplicate parts.
- Comment extraction no longer mistakes the hide-replies toggle ("Alle Antworten verbergen" / "hide all replies") for the reply text.

### Added (previously)
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
