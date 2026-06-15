import { ensureHighlightReady } from '../../../adapters/instagram/highlight.ts';
import type { CapturePage, CommentRecord, ElementHandle } from '../../../schemas/index.ts';
import { bannerText, setScreenshotBanner } from './banner.ts';
import { expandCommentForCapture, planCommentMultipart } from '../multipart/planner.ts';
import {
  captureQuickCommentScreenshot,
  hashBuffer,
  runPayloadOnElement,
  savePart,
  takeScreenshot,
  VERIFY_SCRIPT,
  writeMetadata,
} from './assets.ts';

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
  await expandCommentForCapture(handle);
  const verify = await handle.evaluate(runPayloadOnElement, {
    body: VERIFY_SCRIPT,
    payload: { mode, partsTotal, top, ...payloadBase },
  });
  if (!(verify as { ok?: boolean })?.ok) return { done: true, lastHash };
  await page.waitForTimeout(180);
  if (!skipHighlight) {
    const hl = await ensureHighlightReady(handle as never, data);
    if (!hl.ok && partIdx > 0) return { done: false, lastHash };
  }
  await page.evaluate(setScreenshotBanner, { text: bannerText(session, page.url(), commentIndex, partIdx + 1, partsTotal) });
  const buffer = await takeScreenshot(page);
  const currentHash = hashBuffer(buffer);
  if (currentHash === lastHash && partIdx > 0) return { done: false, lastHash };
  const suffix = partIdx === 0 ? '' : `-part${partIdx + 1}`;
  await savePart(outDir, session, `${session.screenshotUuid}${suffix}.png`, buffer);
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
  payloadBase: Record<string, unknown>,
  lastHash: string | null,
  skipHighlight: boolean,
) => {
  await expandCommentForCapture(handle);
  const tile = await handle.evaluate(runPayloadOnElement, {
    body: VERIFY_SCRIPT,
    payload: { partIndex: tileIdx, partsTotal: total, ...payloadBase },
  });
  if (!(tile as { ok?: boolean })?.ok) return { done: true, lastHash };
  await page.waitForTimeout(120);
  if (!skipHighlight) await ensureHighlightReady(handle as never, data);
  await page.evaluate(setScreenshotBanner, { text: bannerText(session, page.url(), commentIndex, tileIdx, total) });
  const clip = (tile as { clip?: Record<string, number> }).clip;
  const buffer = await takeScreenshot(page, clip);
  const currentHash = hashBuffer(buffer);
  if (currentHash === lastHash && tileIdx > 1) return { done: false, lastHash };
  const partSuffix = tileIdx === 1 ? 'element' : `element-part${tileIdx}`;
  await savePart(outDir, session, `${session.screenshotUuid}-${partSuffix}.png`, buffer);
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
    const result = await captureTilePart(page, handle, data, outDir, session, commentIndex, tileIdx, plan.plannedParts3plus, payloadBase, hash, skipHighlight);
    if (result.done) return hash;
    hash = result.lastHash;
    tileIdx += 1;
  }
  return hash;
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

  await expandCommentForCapture(handle);
  const plan = await planCommentMultipart(handle, data);
  const payloadBase = {
    commentPermalink: data.commentPermalink,
    text: data.text,
    userProfilePath: data.userProfilePath,
    username: data.username,
  };

  const lastScreenshotHash = plan.use3plusRoute
    ? await captureTileSequence(page, handle, data, outDir, session, commentIndex, plan, payloadBase, lastHash, skipHighlight)
    : await captureScrollSequence(page, handle, data, outDir, session, commentIndex, plan, payloadBase, lastHash, skipHighlight);
  const metadataPath = await writeMetadata(page, outDir, data, commentIndex, session);
  return { lastScreenshotHash, metadataPath, screenshotKeys: session.screenshotKeys, screenshotPaths: session.screenshotPaths };
};
