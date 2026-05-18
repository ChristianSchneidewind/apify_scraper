import asyncio
import json
import time

from apify import Actor


def enable_comment_network_debug(page, kv_store):
    def _short(s, n=300):
        return (s[:n] + "…") if s and len(s) > n else s

    def _schedule_debug_task(coro):
        task = asyncio.create_task(coro)

        def _log_task_result(t: asyncio.Task) -> None:
            if t.cancelled():
                return
            exc = t.exception()
            if exc:
                Actor.log.warning(f"[COMMENTS-DEBUG] background task failed: {exc}")

        task.add_done_callback(_log_task_result)

    saved_comment_responses = {"count": 0}
    comment_query_names = {
        "PolarisPostCommentsContainerQuery",
        "PolarisClipsDesktopCommentsPopoverQuery",
        "PolarisPostCommentsPaginationQuery",
        "PolarisPostChildCommentsQuery",
    }
    comment_doc_ids = {
        "26113520058347588",
        "26591948213770017",
        "25516980651312394",
        "34884685271179117",
        "17953756669066153",
    }

    async def on_request(request):
        try:
            url = request.url
            post_data = request.post_data or ""
            has_comment_hint = (
                "comment" in url.lower()
                or "comment" in post_data.lower()
                or any(name in post_data for name in comment_query_names)
                or any(doc in post_data for doc in comment_doc_ids)
                or any(doc in url for doc in comment_doc_ids)
            )
            if not has_comment_hint:
                return
            saved_comment_responses["count"] += 1
            idx = saved_comment_responses["count"]
            key = f"debug-comments-req-{idx:03d}.json"
            payload = {
                "index": idx,
                "url": url,
                "method": request.method,
                "postData": post_data,
            }
            await kv_store.set_value(key, json.dumps(payload, indent=2), content_type="application/json")
            Actor.log.info(f"[COMMENTS-DEBUG] saved {key}")
        except Exception as exc:
            Actor.log.warning(f"[COMMENTS-DEBUG] request save failed: {exc}")

    async def on_response(response):
        url = response.url
        body = None
        if "instagram.com/api" in url or "/graphql/" in url or "comments" in url:
            try:
                body = await response.text()
            except Exception:
                body = "<no body>"
            Actor.log.info(f"[RESP] {response.status} {url} body={_short(body)}")

        try:
            req = response.request
            post_data = req.post_data or ""
            is_comment_query = (
                "comment" in url.lower()
                or "comment" in post_data.lower()
                or any(name in post_data for name in comment_query_names)
                or any(doc in post_data for doc in comment_doc_ids)
                or any(doc in url for doc in comment_doc_ids)
            )
            if not is_comment_query:
                return

            saved_comment_responses["count"] += 1
            idx = saved_comment_responses["count"]
            if body is None:
                try:
                    body = await response.text()
                except Exception:
                    body = "<no body>"
            payload = {
                "index": idx,
                "status": response.status,
                "url": url,
                "method": req.method,
                "postData": post_data,
                "body": body if isinstance(body, str) else "<non-text body>",
            }
            key = f"debug-comments-resp-{idx:03d}.json"
            await kv_store.set_value(key, json.dumps(payload, indent=2), content_type="application/json")
            Actor.log.info(f"[COMMENTS-DEBUG] saved {key}")
        except Exception as exc:
            Actor.log.warning(f"[COMMENTS-DEBUG] response save failed: {exc}")

    page.on("request", lambda r: _schedule_debug_task(on_request(r)))
    page.on("response", lambda r: _schedule_debug_task(on_response(r)))


async def dump_no_comments_debug(page, kv_store, screenshot_timeout_ms: int):
    debug_stamp = int(time.time_ns() // 1_000_000)
    debug_key = f"debug-{debug_stamp}.png"
    debug_buffer = await page.screenshot(full_page=True, timeout=screenshot_timeout_ms)
    await kv_store.set_value(debug_key, debug_buffer, content_type="image/png")
    html_key = f"debug-{debug_stamp}-page.html"
    html = await page.content()
    await kv_store.set_value(html_key, html, content_type="text/html")

    time_samples = await page.eval_on_selector_all("time", "nodes => nodes.slice(0, 5).map(node => node.outerHTML)")
    container_samples = await page.eval_on_selector_all(
        "time",
        """
        nodes => nodes.slice(0, 3).map(node => {
          let current = node.parentElement;
          const results = [];
          for (let i = 0; i < 4 && current; i += 1) {
            results.push(current.outerHTML.slice(0, 800));
            current = current.parentElement;
          }
          return { time: node.outerHTML, ancestors: results };
        })
        """,
    )
    sample_key = f"debug-{debug_stamp}-samples.json"
    await kv_store.set_value(
        sample_key,
        json.dumps({"timeSamples": time_samples, "containerSamples": container_samples}, indent=2),
        content_type="application/json",
    )

    Actor.log.warning(
        f"No comments found. Saved debug screenshot {debug_key}, HTML {html_key}, samples {sample_key}"
    )
