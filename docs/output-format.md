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
    "likersCount": "0",
    "incompleteLikersCount": "0",
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
| `commentLikers` | Empty while liker-profile collection is disabled |
| `likersComplete` | `false` while collection is disabled |
| `likersReason` | `liker_collection_disabled` in the current production path |
| `screenshotPaths` | One or more screenshot files |
| `partsTotal` | Number of screenshot parts |
| `multipartNeedsReview` | Whether the capture has more than two parts |
| `commentPermalink` | Relative Instagram comment link |
| `commentUrl` | Absolute comment URL when available |

Liker-profile collection is intentionally disabled until the Instagram dialog flow is reliable. Visible `likesCount` is retained, `commentLikers` is empty, and `likersReason` is `liker_collection_disabled`.

## Profile artifacts

Profile scraping writes a JSON profile record and one screenshot into a timestamped `<timestamp>_<profile>/` directory below `--out-dir`. The screenshot includes a provenance banner with the source URL, capture time, and UUIDv7. The CLI result includes `durationMs` for the profile run. The JSON contains the source URL, username, biography, full name, avatar URL, title, description, and profile statistics.

## Repost artifacts

`scrape reposts` navigates to the profile's `/reposts` URL, scrolls to the end to trigger lazy loading, waits for images, then returns to the top and saves viewport-sized PNGs named with UUIDv7 identifiers. Each run gets a timestamped `<timestamp>_<profile>/` directory below `--out-dir`. A `<profile>-reposts.json` manifest records the source URLs, discovered repost links, screenshot paths, page dimensions, and capture duration. Links are collected during every scroll round and deduplicated.
