# CLI options reference

Global options can be used with every command:

| Option | Description |
| --- | --- |
| `--browser-profile <name>` | Persistent profile name; default `default` |
| `--cwd <path>` | Working directory for profiles and relative paths |
| `--dry-run` | Validate without opening a browser or writing artifacts |
| `--headless` | Run Chromium without a visible window |
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

The command opens Instagram and waits for manual login. The resulting session is persisted for the selected browser profile.

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
