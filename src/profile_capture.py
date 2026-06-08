from .log_events import log_event, warn_event
from .payloads import build_profile_dataset_payload, build_profile_metadata_payload
from .screenshots import init_screenshot_session, save_comment_metadata, save_screenshot
from .instagram_urls import extract_profile_username


async def extract_profile_page_data(page, source_url: str) -> dict:
    fallback_username = extract_profile_username(source_url)
    try:
        data = await page.evaluate(
            r"""
            () => {
              const text = (node) => (node?.textContent || '').replace(/\s+/g, ' ').trim();
              const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
              const usernameFromOg = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
              const heading = document.querySelector('header h1, header h2');
              const usernameNode = document.querySelector('header section h2, header h1');
              const bioCandidates = Array.from(document.querySelectorAll('header section span, header section div span'));
              const statNodes = Array.from(document.querySelectorAll('header li, header section ul li'));
              const stats = statNodes.map((node) => text(node)).filter(Boolean);
              const avatar = document.querySelector('header img')?.getAttribute('src') || null;
              const username = text(usernameNode) || text(heading) || null;
              let biography = '';
              for (const node of bioCandidates) {
                const value = text(node);
                if (!value) continue;
                if (username && value === username) continue;
                if (stats.some((item) => value === item)) continue;
                if (value.toLowerCase().includes('followers') || value.toLowerCase().includes('following')) continue;
                biography = value;
                break;
              }
              return {
                username,
                fullName: text(heading) || null,
                biography: biography || metaDescription || '',
                stats,
                avatarUrl: avatar,
              };
            }
            """
        )
    except Exception as exc:
        warn_event("profile.extract_data_failed", source_url=source_url, error=str(exc))
        data = {}

    if not isinstance(data, dict):
        data = {}
    data.setdefault("username", fallback_username)
    data.setdefault("fullName", None)
    data.setdefault("biography", "")
    data.setdefault("stats", [])
    data.setdefault("avatarUrl", None)
    return data


async def capture_profile_page(*, page, dataset, kv_store, run_folder: str, source_url: str, screenshot_timeout_ms: int, profile_capture_wait_secs: int = 3) -> int:
    await page.wait_for_timeout(max(0, int(profile_capture_wait_secs)) * 1000)
    profile_data = await extract_profile_page_data(page, source_url)

    screenshot_ctx = init_screenshot_session()
    screenshot_uuid = screenshot_ctx.screenshot_uuid
    screenshot_utc = screenshot_ctx.screenshot_utc

    screenshot_key = f"{screenshot_uuid}-profile.png"
    screenshot_buffer = await page.screenshot(full_page=True, timeout=screenshot_timeout_ms)
    await kv_store.set_value(screenshot_key, screenshot_buffer, content_type="image/png")
    screenshot_path = await save_screenshot(screenshot_buffer, screenshot_key, subdir=run_folder)

    metadata = build_profile_metadata_payload(
        screenshot_uuid=screenshot_uuid,
        screenshot_utc=screenshot_utc,
        source_url=source_url,
        screenshot_keys=[screenshot_key],
        screenshot_paths=[screenshot_path],
        profile_data=profile_data,
    )
    metadata_path = save_comment_metadata(metadata, screenshot_key, subdir=run_folder)

    payload = build_profile_dataset_payload(
        screenshot_uuid=screenshot_uuid,
        source_url=source_url,
        screenshot_keys=[screenshot_key],
        screenshot_paths=[screenshot_path],
        metadata_path=metadata_path,
        profile_data=profile_data,
    )
    await dataset.push_data(payload)

    log_event(
        "profile.captured",
        username=profile_data.get("username"),
        source_url=source_url,
        screenshot_key=screenshot_key,
    )
    return 1
