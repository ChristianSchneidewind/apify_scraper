import { appendTextFile } from '../../adapters/filesystem/output.ts';
import { ensureHighlightReady } from '../../adapters/instagram/highlight.ts';
import { prepareCommentScreenshotVisuals } from '../../adapters/instagram/visual.ts';
import type {
  CommentRecord,
  ElementHandle,
  EnrichedComment,
  LikersPage,
  ProcessOptions,
  ProcessState,
  TimeLocator,
} from '../../schemas/index.ts';
import {
  buildCommentIdentity,
  registerCommentSeen,
  shouldProcessCandidate,
} from './comment-state.ts';
import { captureCommentAssets } from './capture/capture.ts';
import { dumpCommentDebugArtifacts } from './capture/debug.ts';
import { initScreenshotSession } from './capture/screenshot-session.ts';
import { computeCommentUid, extractCommentFromItem, extractCommentFromTime, refindCommentRowHandle, resolveCommentRowHandle } from './extract-from-locator.ts';
import { buildCommentOutputRecord } from './output.ts';

const logStage = (index: number, stage: string, quiet?: boolean) => {
  if (quiet) return;
  process.stderr.write(`[scrape.comments] comment ${index}: ${stage}\n`);
};

const fallbackCapture = async (
  page: LikersPage,
  outDir: string,
  index: number,
  data: CommentRecord,
  lastScreenshotHash: string | null,
  reason: string,
) => {
  process.stderr.write(`[scrape.comments] comment ${index}: capture fallback ${reason}\n`);
  try {
    await appendTextFile(outDir, 'capture-debug.jsonl', `${JSON.stringify({ commentIndex: index, reason, stage: 'capture fallback', ts: new Date().toISOString() })}\n`);
  } catch {}
  await dumpCommentDebugArtifacts(page, outDir, index, data, 30000);
  return { lastScreenshotHash, metadataPath: null, screenshotKeys: [] as string[], screenshotPaths: [] as string[] };
};

const withTimeout = async <T>(promise: Promise<T>, ms: number) => {
  const timeout = new Promise<T>((_, reject) => setTimeout(() => reject(new Error('capture step timeout')), ms));
  return Promise.race([promise, timeout]);
};

const appendCaptureError = async (outDir: string, index: number, reason: string) => {
  const item = { commentIndex: index, reason, stage: 'capture error', ts: new Date().toISOString() };
  await appendTextFile(outDir, 'capture-debug.jsonl', `${JSON.stringify(item)}\n`).catch(() => undefined);
};

const runCapture = async (
  page: LikersPage,
  handle: ElementHandle,
  data: CommentRecord,
  outDir: string,
  index: number,
  lastScreenshotHash: string | null,
) => withTimeout(
  captureCommentAssets(page, handle, data, outDir, initScreenshotSession(), index, lastScreenshotHash, false),
  12000,
).catch((error: unknown) => {
  const reason = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[scrape.comments] comment ${index}: capture error ${reason}\n`);
  void appendCaptureError(outDir, index, reason);
  return fallbackCapture(page, outDir, index, data, lastScreenshotHash, reason);
});

const rollbackHighlightFailure = (
  state: ProcessState,
  strictKey: string,
  looseKey: string,
  permalink: string | null,
  commentUid: string | null,
) => {
  state.count -= 1;
  state.newInRound -= 1;
  const failureKey = commentUid || permalink || strictKey;
  const failures = state.highlightFailures || new Map<string, number>();
  state.highlightFailures = failures;
  const attempts = (failures.get(failureKey) || 0) + 1;
  failures.set(failureKey, attempts);
  if (attempts >= 3) return false;
  state.seenStrict.delete(strictKey);
  state.seenLoose.delete(looseKey);
  if (permalink) state.seenPermalink.delete(permalink);
  if (commentUid) state.seenUid.delete(commentUid);
  return true;
};

const cleanupPreviousHighlightBrowser = () => {
  document.querySelectorAll('[data-apify-highlight-overlay="1"]').forEach((node) => node.remove());
  document.querySelectorAll<HTMLElement>('[data-apify-highlight="1"]').forEach((node) => {
    node.style.outline = '';
    node.style.outlineOffset = '';
    node.style.boxShadow = '';
    node.style.backgroundColor = '';
    node.style.backgroundClip = '';
    node.removeAttribute('data-apify-highlight');
  });
  document.body.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 4, clientY: 4 }));
  return true;
};

const cleanupPreviousHighlight = async (page: LikersPage) => {
  if (typeof page.evaluate !== 'function') return;
  await Promise.resolve(page.evaluate(cleanupPreviousHighlightBrowser, undefined)).catch(() => undefined);
};

const prepareCommentForCapture = async (
  page: LikersPage,
  rowHandle: TimeLocator,
) => {
  await cleanupPreviousHighlight(page);
  const currentUrl = typeof page.url === 'function' ? page.url() : '';
  if (!/\/reels?\//.test(currentUrl) && rowHandle?.evaluate) {
    await rowHandle.evaluate((el: Element) => (el.scrollIntoView({ block: 'center', inline: 'nearest' }), true), undefined).catch(() => undefined);
  }
  if (page.waitForTimeout) await Promise.allSettled([page.waitForTimeout(250)]);
};

const captureComment = async (
  page: LikersPage,
  rowHandle: TimeLocator,
  data: CommentRecord,
  options: ProcessOptions,
  state: ProcessState,
) => {
  logStage(state.count, 'capture', options.quiet);
  const capture = await runCapture(page, rowHandle, data, options.outDir, state.count, state.lastScreenshotHash);
  state.lastScreenshotHash = capture.lastScreenshotHash;
  logStage(state.count, 'done', options.quiet);
  return buildCommentOutputRecord(data, page.url(), state.count, capture.screenshotKeys, capture.screenshotPaths, capture.metadataPath) as EnrichedComment;
};

// Liker profile collection is intentionally disabled. Keep likesCount from
// the comment row, but do not open liker dialogs or deep-link tabs.
const withoutLikerCollection = (data: CommentRecord) => ({
  ...data,
  commentLikers: [],
  likersComplete: false,
  likersReason: 'liker_collection_disabled',
});

const highlightCandidate = async (
  page: LikersPage,
  rowHandle: TimeLocator,
  locator: TimeLocator,
  data: CommentRecord,
) => {
  const primary = await ensureHighlightReady(rowHandle, data);
  if (primary.ok) return { handle: rowHandle, result: primary };
  const refound = await refindCommentRowHandle(page, data);
  if (refound) {
    const retried = await ensureHighlightReady(refound, data);
    if (retried.ok) return { handle: refound, result: retried };
  }
  if (rowHandle === locator) return { handle: rowHandle, result: primary };
  const fallback = await ensureHighlightReady(locator, data);
  return { handle: fallback.ok ? locator : rowHandle, result: fallback.ok ? fallback : primary };
};

export const processCommentCandidate = async (
  page: LikersPage,
  locator: TimeLocator,
  state: ProcessState,
  options: ProcessOptions,
) => {
  const data = await extractCommentFromItem(locator) || await extractCommentFromTime(locator);
  if (!data) return null;
  const { looseKey, permalink, strictKey } = buildCommentIdentity(data);
  const commentUid = await computeCommentUid(locator);
  if (!commentUid && !permalink) return null;
  if (!shouldProcessCandidate(state, strictKey, looseKey, permalink || null, commentUid)) return null;
  registerCommentSeen(state, strictKey, looseKey, permalink || null, commentUid);
  state.count += 1;
  state.newInRound += 1;
  logStage(state.count, 'extract', options.quiet);
  const rowHandle = await resolveCommentRowHandle(locator);
  await prepareCommentForCapture(page, rowHandle);
  const enriched = withoutLikerCollection(data);
  logStage(state.count, 'highlight', options.quiet);
  const highlighted = await highlightCandidate(page, rowHandle, locator, enriched);
  const highlight = highlighted.result;
  logStage(state.count, `highlight result ${highlight.ok ? 'ok' : highlight.reason}`, options.quiet);
  if (!highlight.ok) {
    logStage(state.count, `highlight failed ${highlight.reason ?? 'unknown'}; skipped`, options.quiet);
    await dumpCommentDebugArtifacts(page, options.outDir, state.count, enriched, 30000);
    state.needsLocatorRefresh = rollbackHighlightFailure(state, strictKey, looseKey, permalink || null, commentUid);
    return null;
  }
  logStage(state.count, 'visuals', options.quiet);
  await prepareCommentScreenshotVisuals(page, highlighted.handle);
  return captureComment(page, highlighted.handle, enriched, options, state);
};
