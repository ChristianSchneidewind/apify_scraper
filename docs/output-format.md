# Output format

## CLI result

Default output is human-readable. `--json` emits one object on stdout. Diagnostics stay on stderr so JSON can be piped safely.

A successful comment scrape includes details such as:

```json
{
  "command": "scrape.comments",
  "ok": true,
  "summary": "scraped 182 comments",
  "details": {
    "commentsCount": "182",
    "likesCount": "1234",
    "likersCount": "1041",
    "incompleteLikersCount": "49",
    "multipartCount": "6",
    "durationMs": "125000",
    "commentsPerSecond": "1.46",
    "avgCommentMs": "687",
    "screenshotCount": "188",
    "jsonPath": "/.../comments.json"
  }
}
```

Failed results include an `errorCode`, for example `AUTH_ERROR`, `BROWSER_ERROR`, `SCRAPE_ERROR`, or `USAGE_ERROR`.

## Comment records

`comments.json` contains a `comments` array. Important fields include:

| Field | Meaning |
| --- | --- |
| `username` | Comment author |
| `text` | Extracted comment text |
| `likesCount` | Likes visible to the scraper |
| `commentLikers` | Collected liker profiles |
| `likersComplete` | Whether collected likers reached the visible likes target |
| `likersReason` | Reason for incomplete collection, if applicable |
| `screenshotPaths` | One or more screenshot files |
| `partsTotal` | Number of screenshot parts |
| `multipartNeedsReview` | Whether the capture has more than two parts |
| `commentPermalink` | Relative Instagram comment link |
| `commentUrl` | Absolute comment URL when available |

A comment with `likesCount > 0` and no visible liker links is not treated as a successful complete collection. It is marked with `likersComplete: false` and a diagnostic `likersReason`.

## Profile artifacts

Profile scraping writes a JSON profile record and one screenshot. The CLI result includes `durationMs` for the profile run. The JSON contains the source URL, username, biography, full name, avatar URL, title, description, and profile statistics.
