# CLI options reference

Global options can be used with every command:

| Option | Description |
| --- | --- |
| `--cdp-url <url>` | Chrome DevTools endpoint of the running Chrome; default `http://127.0.0.1:9222` |
| `--cwd <path>` | Working directory for relative paths |
| `--dry-run` | Validate without attaching to Chrome or writing artifacts |
| `--evidence` | Write `actions.ndjson` and a SHA-256 `manifest.json` per run |
| `--headless` | Deprecated no-op; CDP mode always uses the running Chrome UI |
| `--json` | Emit one JSON result on stdout |
| `--plain` | Emit stable tab-separated output |
| `--no-input` | Disable interactive prompts |
| `--quiet` | Suppress normal diagnostics |
| `--verbose` | Enable detailed diagnostics |
| `--no-color` | Keep output non-colored |

## `auth login`

```bash
instagram auth login [global options]
```

The command opens Instagram in the connected Chrome and waits for the human
to complete the login there. The session persists in the real Chrome profile;
the command only verifies the resulting state.

## `scrape comments`

> Liker-profile collection is temporarily disabled. Liker-related flags remain accepted for compatibility but do not trigger dialog collection.

| Option | Description |
| --- | --- |
| `--url <url>` | Instagram post or reel URL; required |
| `--out-dir <path>` | Artifact root; default `artifacts/comments` |
| `--max-comments <n>` | Maximum comments; `0` means unlimited |
| `--max-comment-likers <n>` | Reserved compatibility option; currently no effect |
| `--liker-collection-mode <mode>` | Reserved compatibility option |
| `--liker-retry-attempts <n>` | Reserved compatibility option |
| `--liker-retry-delay-ms <n>` | Reserved compatibility option |
| `--liker-timeout-ms <n>` | Reserved compatibility option |
| `--max-ui-rounds <n>` | Maximum comment expansion/scroll rounds |
| `--ui-idle-rounds <n>` | Stop after this many idle rounds |
| `--resume <path>` | Resume from a previous `checkpoint.json` |
| `--retry-incomplete-likers` | Reserved compatibility option; currently no effect |

## `scrape profiles`

| Option | Description |
| --- | --- |
| `--url <url>` | Instagram profile URL; required |
| `--profile-slug <slug>` | Output slug; inferred from URL when omitted |
| `--out-dir <path>` | Artifact directory; required. Each run creates a timestamped profile folder. |

Profile screenshots include a provenance banner and are stored together with the profile JSON in a `<timestamp>_<profile>/` folder.

## `scrape reposts`

| Option | Description |
| --- | --- |
| `--url <url>` | Instagram profile URL; `/reposts` is added automatically |
| `--out-dir <path>` | Artifact directory; required |

The command first scrolls to the end of the reposts page to trigger lazy loading, then returns to the top and saves viewport-sized screenshots through the end. A manifest JSON file is written alongside the screenshots.

## Exit codes

- `0`: success
- `2`: invalid command or runtime context
- `3`: authentication error
- `4`: browser startup/runtime error
- `5`: scraping error
