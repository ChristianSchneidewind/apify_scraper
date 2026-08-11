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

| Option | Description |
| --- | --- |
| `--url <url>` | Instagram post or reel URL; required |
| `--out-dir <path>` | Artifact root; default `artifacts/comments` |
| `--max-comments <n>` | Maximum comments; `0` means unlimited |
| `--max-comment-likers <n>` | Maximum likers per comment; `0` means all visible |
| `--liker-collection-mode <mode>` | `best_effort` or `strict` |
| `--liker-retry-attempts <n>` | Additional liker attempts; default uses adaptive behavior |
| `--liker-retry-delay-ms <n>` | Initial retry delay; subsequent retries use exponential backoff |
| `--liker-timeout-ms <n>` | Timeout per liker collection attempt |
| `--max-ui-rounds <n>` | Maximum comment expansion/scroll rounds |
| `--ui-idle-rounds <n>` | Stop after this many idle rounds |
| `--resume <path>` | Resume from a previous `checkpoint.json` |
| `--retry-incomplete-likers` | Retry resumed comments with incomplete liker data |

## `scrape profiles`

| Option | Description |
| --- | --- |
| `--url <url>` | Instagram profile URL; required |
| `--profile-slug <slug>` | Output slug; inferred from URL when omitted |
| `--out-dir <path>` | Artifact directory; required |

## Exit codes

- `0`: success
- `2`: invalid command or runtime context
- `3`: authentication error
- `4`: browser startup/runtime error
- `5`: scraping error
