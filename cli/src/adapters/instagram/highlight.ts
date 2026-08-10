import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CommentRecord, HighlightResult } from '../../schemas/index.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const HIGHLIGHT_COMMENT_SCRIPT = readFileSync(join(dir, 'browser-scripts/highlight-comment.script'), 'utf8');

export const buildHighlightPayload = (data: CommentRecord) => ({
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

const scrollIntoView = (handle: { evaluate: <T, A>(fn: (el: Element, args: A) => T, args: A) => Promise<T> }) =>
  withTimeout(handle.evaluate((el: Element) => (el.scrollIntoView({ block: 'center', inline: 'nearest' }), true), undefined as never), 1500)
    .catch(() => undefined);

const runHighlightBrowser = (
  el: Element,
  args: { body: string; payload: ReturnType<typeof buildHighlightPayload> },
) => {
  const fnSource = args.body.trim().replace(/^return\s+/, '').replace(/;\s*$/, '');
  return new Function('payload', 'return (' + fnSource + ')(payload);')({ ...args.payload, el }) as HighlightResult;
};

export const highlightComment = async (
  handle: { evaluate: <T, A>(fn: (el: Element, args: A) => T, args: A) => Promise<T> },
  data: CommentRecord,
) => {
  const result = await withTimeout(
    handle.evaluate(runHighlightBrowser, { body: HIGHLIGHT_COMMENT_SCRIPT, payload: buildHighlightPayload(data) }),
    2500,
  ).catch((error) => ({ ok: false, reason: error instanceof Error ? error.message : 'highlight_error' }));
  return result || { ok: false, reason: 'invalid_result' };
};

const logHighlightFailure = (result: HighlightResult, attempt: number) => {
  process.stderr.write(`[scrape.comments] highlight attempt ${attempt}: ${result.reason ?? 'unknown'}\n`);
  const rect = (result as { rect?: { w?: number; h?: number } }).rect;
  if (rect) process.stderr.write(`[scrape.comments] highlight rect ${rect.w ?? '?'}x${rect.h ?? '?'}\n`);
  if (result.rowTag) process.stderr.write(`[scrape.comments] highlight row ${result.rowTag}: ${String(result.rowText || '').slice(0, 120)}\n`);
  if (result.selectedTag) process.stderr.write(`[scrape.comments] highlight selected ${result.selectedTag}: ${String(result.selectedText || '').slice(0, 120)}\n`);
};

export const ensureHighlightReady = async (
  handle: { evaluate: <T, A>(fn: (el: Element, args: A) => T, args: A) => Promise<T> },
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
