import { appendTextFile } from '../../adapters/filesystem/output.ts';
import { ensureHighlightReady } from '../../adapters/instagram/highlight.ts';
import { prepareCommentScreenshotVisuals } from '../../adapters/instagram/visual.ts';
import type {
  CommentRecord,
  DebugPage,
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
import { computeCommentUid, extractCommentFromItem, extractCommentFromTime, resolveCommentRowHandle } from './extract-from-locator.ts';
import { enrichCommentLikers } from './likers/enrich.ts';
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
  await dumpCommentDebugArtifacts(page as unknown as DebugPage, outDir, index, data, 30000);
  return { lastScreenshotHash, metadataPath: null, screenshotKeys: [] as string[], screenshotPaths: [] as string[] };
};

const withTimeout = async <T>(promise: Promise<T>, ms: number) => {
  const timeout = new Promise<T>((_, reject) => setTimeout(() => reject(new Error('capture step timeout')), ms));
  return Promise.race([promise, timeout]);
};

const runCapture = async (
  page: LikersPage,
  handle: { evaluate: <T, A>(fn: (el: Element, args: A) => T, args: A) => Promise<T> },
  data: CommentRecord,
  outDir: string,
  index: number,
  lastScreenshotHash: string | null,
) => withTimeout(
  captureCommentAssets(page as never, handle as never, data, outDir, initScreenshotSession(), index, lastScreenshotHash, false),
  12000,
).catch((error: unknown) => {
  const reason = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[scrape.comments] comment ${index}: capture error ${reason}\n`);
  void (async () => {
    try {
      await appendTextFile(outDir, 'capture-debug.jsonl', `${JSON.stringify({ commentIndex: index, reason, stage: 'capture error', ts: new Date().toISOString() })}\n`);
    } catch {}
  })();
  return fallbackCapture(page, outDir, index, data, lastScreenshotHash, reason);
});

const rollbackHighlightFailure = (state: ProcessState) => {
  state.count -= 1;
  state.newInRound -= 1;
};

const prepareCommentForLikers = async (
  page: LikersPage,
  rowHandle: TimeLocator,
) => {
  if (rowHandle?.evaluate) {
    await Promise.allSettled([
      rowHandle.evaluate((el: Element) => (el.scrollIntoView({ block: 'center', inline: 'nearest' }), true), undefined as never),
    ]);
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
  const capture = await runCapture(page, rowHandle as never, data, options.outDir, state.count, state.lastScreenshotHash);
  state.lastScreenshotHash = capture.lastScreenshotHash;
  logStage(state.count, 'done', options.quiet);
  return buildCommentOutputRecord(data, page.url(), state.count, capture.screenshotKeys, capture.screenshotPaths, capture.metadataPath) as EnrichedComment;
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
  await prepareCommentForLikers(page, rowHandle as never);
  logStage(state.count, 'likers', options.quiet);
  const enriched = await enrichCommentLikers(
    page,
    rowHandle as never,
    data,
    options.maxCommentLikers,
    options.likerCollectionMode,
    options.verbose,
  );
  logStage(state.count, 'highlight', options.quiet);
  const highlight = await ensureHighlightReady(rowHandle as never, enriched);
  logStage(state.count, `highlight result ${highlight.ok ? 'ok' : highlight.reason}`, options.quiet);
  if (!highlight.ok) {
    logStage(state.count, `highlight failed ${highlight.reason ?? 'unknown'}; skipped`, options.quiet);
    await dumpCommentDebugArtifacts(page as unknown as DebugPage, options.outDir, state.count, enriched, 30000);
    rollbackHighlightFailure(state);
    return null;
  }
  logStage(state.count, 'visuals', options.quiet);
  await prepareCommentScreenshotVisuals(page, rowHandle as never);
  return captureComment(page, rowHandle as never, enriched, options, state);
};
