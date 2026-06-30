import { appendTextFile } from '../../../adapters/filesystem/output.ts';
import { ensureHighlightReady } from '../../../adapters/instagram/highlight.ts';
import type { CapturePage, CommentRecord, ElementHandle } from '../../../schemas/index.ts';
import { bannerText, setScreenshotBanner } from './banner.ts';
import { expandCommentForCapture, planCommentMultipart } from '../multipart/planner.ts';
import { estimateRowParts } from '../multipart/decisions.ts';
import {
  captureQuickCommentScreenshot,
  hashBuffer,
  runPayloadOnElement,
  savePart,
  takeScreenshot,
  TILE_3PLUS_SCRIPT,
  VERIFY_SCRIPT,
  writeMetadata,
} from './assets.ts';

const logCaptureDebug = async (
  outDir: string,
  commentIndex: number,
  stage: string,
  extra?: Record<string, unknown>,
) => {
  const suffix = extra ? ` ${JSON.stringify(extra)}` : '';
  process.stderr.write(`[scrape.comments] comment ${commentIndex}: ${stage}${suffix}\n`);
  try {
    await appendTextFile(outDir, 'capture-debug.jsonl', `${JSON.stringify({ commentIndex, extra: extra ?? null, stage, ts: new Date().toISOString() })}\n`);
  } catch {}
};

const captureScrollPart = async (
  page: CapturePage,
  handle: ElementHandle,
  data: CommentRecord,
  outDir: string,
  session: {
    screenshotKeys: string[];
    screenshotPaths: string[];
    screenshotUtc: string;
    screenshotUuid: string;
  },
  mode: string,
  commentIndex: number,
  partIdx: number,
  partsTotal: number,
  top: number,
  payloadBase: Record<string, unknown>,
  lastHash: string | null,
  skipHighlight: boolean,
) => {
  await logCaptureDebug(outDir, commentIndex, 'capture scroll part:start', { mode, part: partIdx + 1, partsTotal, top });
  await expandCommentForCapture(handle);
  const verify = await handle.evaluate(runPayloadOnElement, {
    body: VERIFY_SCRIPT,
    payload: { mode, partsTotal, top, ...payloadBase },
  });
  if (!(verify as { ok?: boolean; reason?: string })?.ok) {
    await logCaptureDebug(outDir, commentIndex, 'capture scroll part:verify_failed', { mode, part: partIdx + 1, partsTotal, reason: (verify as { reason?: string })?.reason ?? null, top });
    return { done: true, lastHash };
  }
  await logCaptureDebug(outDir, commentIndex, 'capture scroll part:verify', {
    mode,
    part: partIdx + 1,
    partsTotal,
    top,
    rowTop: (verify as { rowTop?: number }).rowTop ?? null,
    rowBottom: (verify as { rowBottom?: number }).rowBottom ?? null,
    maxBottom: (verify as { maxBottom?: number }).maxBottom ?? null,
    metrics: (verify as { metrics?: Record<string, unknown> }).metrics ?? null,
    debug: (verify as { debug?: Record<string, unknown> }).debug ?? null,
  });
  await page.waitForTimeout(180);
  if (!skipHighlight) {
    const hl = await ensureHighlightReady(handle as never, data);
    if (!hl.ok && partIdx > 0) return { done: false, lastHash };
  }
  await page.evaluate(setScreenshotBanner, { text: bannerText(session, page.url(), commentIndex, partIdx + 1, partsTotal) });
  const buffer = await takeScreenshot(page);
  const currentHash = hashBuffer(buffer);
  if (currentHash === lastHash && partIdx > 0) {
    await logCaptureDebug(outDir, commentIndex, 'capture scroll part:duplicate_hash', { mode, part: partIdx + 1, partsTotal, top });
    return { done: false, lastHash };
  }
  const suffix = partIdx === 0 ? '' : `-part${partIdx + 1}`;
  await savePart(outDir, session, `${session.screenshotUuid}${suffix}.png`, buffer);
  await logCaptureDebug(outDir, commentIndex, 'capture scroll part:saved', { mode, part: partIdx + 1, partsTotal, top, bytes: buffer.length });
  return { done: false, lastHash: currentHash };
};

const captureTilePart = async (
  page: CapturePage,
  handle: ElementHandle,
  data: CommentRecord,
  outDir: string,
  session: {
    screenshotKeys: string[];
    screenshotPaths: string[];
    screenshotUtc: string;
    screenshotUuid: string;
  },
  commentIndex: number,
  tileIdx: number,
  total: number,
  plan: Awaited<ReturnType<typeof planCommentMultipart>>,
  payloadBase: Record<string, unknown>,
  lastHash: string | null,
  skipHighlight: boolean,
) => {
  await logCaptureDebug(outDir, commentIndex, 'capture tile part:start', { part: tileIdx, partsTotal: total, planMode: plan.mode });
  await expandCommentForCapture(handle);
  const tile = await handle.evaluate(runPayloadOnElement, {
    body: TILE_3PLUS_SCRIPT,
    payload: { baseSig: plan.baseSig, partIndex: tileIdx, partsTotal: total, ...payloadBase },
  });
  if (!(tile as { ok?: boolean; reason?: string })?.ok) {
    await logCaptureDebug(outDir, commentIndex, 'capture tile part:verify_failed', { part: tileIdx, partsTotal: total, planMode: plan.mode, reason: (tile as { reason?: string })?.reason ?? null });
    return { done: true, lastHash };
  }
  await page.waitForTimeout(120);
  if (!skipHighlight) await ensureHighlightReady(handle as never, data);
  await page.evaluate(setScreenshotBanner, { text: bannerText(session, page.url(), commentIndex, tileIdx, total) });
  const clip = (tile as { clip?: Record<string, number>; debug?: Record<string, unknown> }).clip;
  await logCaptureDebug(outDir, commentIndex, 'capture tile part:clip', { part: tileIdx, partsTotal: total, clip: clip ?? null, debug: (tile as { debug?: Record<string, unknown> }).debug ?? null });
  const buffer = await takeScreenshot(page, clip);
  const currentHash = hashBuffer(buffer);
  if (currentHash === lastHash && tileIdx > 1) {
    await logCaptureDebug(outDir, commentIndex, 'capture tile part:duplicate_hash', { part: tileIdx, partsTotal: total });
    return { done: false, lastHash };
  }
  const partSuffix = tileIdx === 1 ? 'element' : `element-part${tileIdx}`;
  await savePart(outDir, session, `${session.screenshotUuid}-${partSuffix}.png`, buffer);
  await logCaptureDebug(outDir, commentIndex, 'capture tile part:saved', { part: tileIdx, partsTotal: total, bytes: buffer.length });
  return { done: false, lastHash: currentHash };
};

const captureScrollSequence = async (
  page: CapturePage,
  handle: ElementHandle,
  data: CommentRecord,
  outDir: string,
  session: {
    screenshotKeys: string[];
    screenshotPaths: string[];
    screenshotUtc: string;
    screenshotUuid: string;
  },
  commentIndex: number,
  plan: Awaited<ReturnType<typeof planCommentMultipart>>,
  payloadBase: Record<string, unknown>,
  lastHash: string | null,
  skipHighlight: boolean,
) => {
  let hash = lastHash;
  let partIdx = 0;
  while (partIdx < plan.scrollParts.length) {
    const top = plan.scrollParts[partIdx] ?? 0;
    const result = await captureScrollPart(page, handle, data, outDir, session, plan.mode, commentIndex, partIdx, plan.scrollParts.length, top, payloadBase, hash, skipHighlight);
    if (result.done) return hash;
    hash = result.lastHash;
    partIdx += 1;
  }
  return hash;
};

const captureTileSequence = async (
  page: CapturePage,
  handle: ElementHandle,
  data: CommentRecord,
  outDir: string,
  session: {
    screenshotKeys: string[];
    screenshotPaths: string[];
    screenshotUtc: string;
    screenshotUuid: string;
  },
  commentIndex: number,
  plan: Awaited<ReturnType<typeof planCommentMultipart>>,
  payloadBase: Record<string, unknown>,
  lastHash: string | null,
  skipHighlight: boolean,
) => {
  let hash = lastHash;
  let tileIdx = 1;
  while (tileIdx <= plan.plannedParts3plus) {
    const result = await captureTilePart(page, handle, data, outDir, session, commentIndex, tileIdx, plan.plannedParts3plus, plan, payloadBase, hash, skipHighlight);
    if (result.done) return hash;
    hash = result.lastHash;
    tileIdx += 1;
  }
  return hash;
};

const maybeEscalateSinglePlan = async (
  handle: ElementHandle,
  outDir: string,
  commentIndex: number,
  plan: Awaited<ReturnType<typeof planCommentMultipart>>,
  payloadBase: Record<string, unknown>,
) => {
  if (plan.mode !== 'single' || plan.totalParts !== 1) return plan;
  const probe = await handle.evaluate(runPayloadOnElement, {
    body: VERIFY_SCRIPT,
    payload: { mode: 'single', partsTotal: 1, top: 0, ...payloadBase },
  });
  const metrics = (probe as { metrics?: { overflow?: number; rowHeight?: number; visibleH?: number } })?.metrics;
  const overflow = Math.max(0, metrics?.overflow ?? 0);
  const clippedBottom = !!(probe as { clippedBottom?: boolean })?.clippedBottom;
  await logCaptureDebug(outDir, commentIndex, 'capture single probe', {
    overflow,
    clippedBottom,
    metrics: metrics ?? null,
  });
  if (!clippedBottom && overflow <= 24) return plan;
  const parts = estimateRowParts(metrics);
  if (parts <= 1) return plan;
  const escalated = {
    ...plan,
    mode: 'row',
    plannedParts3plus: parts,
    scrollParts: Array.from({ length: parts }, (_, i) => i),
    totalParts: parts,
    use3plusRoute: true,
  };
  await logCaptureDebug(outDir, commentIndex, 'capture escalate multipart', {
    fromMode: plan.mode,
    toMode: escalated.mode,
    parts,
    overflow,
  });
  return escalated;
};

export const captureCommentAssets = async (
  page: CapturePage,
  handle: ElementHandle,
  data: CommentRecord,
  outDir: string,
  session: {
    screenshotKeys: string[];
    screenshotPaths: string[];
    screenshotUtc: string;
    screenshotUuid: string;
  },
  commentIndex: number,
  lastHash: string | null,
  skipHighlight = false,
) => {
  if (skipHighlight) {
    const quick = await captureQuickCommentScreenshot(page, handle, data, outDir, session, commentIndex, lastHash);
    return { lastScreenshotHash: quick.lastScreenshotHash, metadataPath: quick.metadataPath, screenshotKeys: session.screenshotKeys, screenshotPaths: session.screenshotPaths };
  }

  let plan = await planCommentMultipart(handle, data);
  const payloadBase = {
    commentPermalink: data.commentPermalink,
    text: data.text,
    userProfilePath: data.userProfilePath,
    username: data.username,
  };

  plan = await maybeEscalateSinglePlan(handle, outDir, commentIndex, plan, payloadBase);

  await logCaptureDebug(outDir, commentIndex, 'capture plan', {
    mode: plan.mode,
    plannedParts3plus: plan.plannedParts3plus,
    scrollParts: plan.scrollParts,
    totalParts: plan.totalParts,
    use3plusRoute: plan.use3plusRoute,
    baseSig: plan.baseSig,
  });

  if (plan.totalParts > 1) {
    await expandCommentForCapture(handle);
  }

  const shouldUseTileRoute = false;
  await logCaptureDebug(outDir, commentIndex, 'capture route', { route: shouldUseTileRoute ? 'tile' : 'scroll', mode: plan.mode });
  const lastScreenshotHash = shouldUseTileRoute
    ? await captureTileSequence(page, handle, data, outDir, session, commentIndex, plan, payloadBase, lastHash, skipHighlight)
    : await captureScrollSequence(page, handle, data, outDir, session, commentIndex, plan, payloadBase, lastHash, skipHighlight);
  const metadataPath = await writeMetadata(page, outDir, data, commentIndex, session);
  await logCaptureDebug(outDir, commentIndex, 'capture done', { partsSaved: session.screenshotKeys.length, metadataPath });
  return { lastScreenshotHash, metadataPath, screenshotKeys: session.screenshotKeys, screenshotPaths: session.screenshotPaths };
};
