import type { CommentRecord, ElementHandle, HighlightPayload, HighlightResult } from '../../schemas/index.ts';
import { highlightCommentBrowser } from './highlight-browser.ts';

export const buildHighlightPayload = (data: CommentRecord): HighlightPayload => ({
  commentPermalink: data.commentPermalink,
  isGifOnly: Boolean(data.isGifOnly),
  text: data.text,
  userProfilePath: data.userProfilePath,
  username: data.username,
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async <T>(promise: Promise<T>, ms: number) => {
  const timeout = new Promise<T>((_, reject) => setTimeout(() => reject(new Error('highlight step timeout')), ms));
  return Promise.race([promise, timeout]);
};

const scrollIntoView = (handle: ElementHandle) =>
  withTimeout(handle.evaluate((el: Element) => {
    const dialog = el.closest('[role="dialog"]');
    if (!dialog) return (el.scrollIntoView({ block: 'center', inline: 'nearest' }), true);
    let parent: Element | null = el.parentElement;
    while (parent && parent !== dialog && parent.scrollHeight - parent.clientHeight <= 20) parent = parent.parentElement;
    if (!parent || parent === dialog) return true;
    const rect = el.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    parent.scrollTop += rect.top - parentRect.top - parent.clientHeight / 2;
    return true;
  }, undefined), 1500).catch(() => undefined);

export const highlightComment = async (
  handle: ElementHandle,
  data: CommentRecord,
) => {
  const result = await withTimeout(
    handle.evaluate(highlightCommentBrowser, buildHighlightPayload(data)),
    2500,
  ).catch((error) => ({ ok: false, reason: error instanceof Error ? error.message : 'highlight_error' }));
  return result || { ok: false, reason: 'invalid_result' };
};

const logHighlightFailure = (result: HighlightResult, attempt: number) => {
  process.stderr.write(`[scrape.comments] highlight attempt ${attempt}: ${result.reason ?? 'unknown'}\n`);
  const rect = result.rect;
  if (rect) process.stderr.write(`[scrape.comments] highlight rect ${rect.w ?? '?'}x${rect.h ?? '?'}\n`);
  if (result.rowTag) process.stderr.write(`[scrape.comments] highlight row ${result.rowTag}: ${String(result.rowText || '').slice(0, 120)}\n`);
  if (result.selectedTag) process.stderr.write(`[scrape.comments] highlight selected ${result.selectedTag}: ${String(result.selectedText || '').slice(0, 120)}\n`);
};

export const ensureHighlightReady = async (
  handle: ElementHandle,
  data: CommentRecord,
) => {
  let lastResult: HighlightResult = { ok: false, reason: 'not_attempted' };
  for (let i = 0; i < 3; i += 1) {
    lastResult = await highlightComment(handle, data);
    if (lastResult.ok) return lastResult;
    logHighlightFailure(lastResult, i + 1);
    await scrollIntoView(handle);
    await sleep(250);
  }
  return { ok: false, reason: 'highlight_retries_exhausted' };
};
