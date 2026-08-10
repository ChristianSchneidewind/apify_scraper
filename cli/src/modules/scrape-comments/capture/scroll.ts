import { ensureHighlightReady } from '../../../adapters/instagram/highlight.ts';
import type {
  CaptureDebugLog,
  CapturePage,
  CapturePartResult,
  CapturePayloadBase,
  CapturePlan,
  CaptureSession,
  CommentRecord,
  ElementHandle,
} from '../../../schemas/index.ts';
import { expandCommentForCapture } from '../multipart/planner.ts';
import { bannerText, setScreenshotBanner } from './banner.ts';
import { hashBuffer, runPayloadOnElement, savePart, takeScreenshot, VERIFY_SCRIPT } from './assets.ts';
import { reinforceHighlightStyles } from './highlight-style.ts';

const logVerify = async (
  log: CaptureDebugLog,
  outDir: string,
  commentIndex: number,
  partIdx: number,
  partsTotal: number,
  top: number,
  mode: string,
  verify: unknown,
) => log(outDir, commentIndex, 'capture scroll part:verify', {
  clip: (verify as { clip?: Record<string, number> }).clip ?? null,
  debug: (verify as { debug?: Record<string, unknown> }).debug ?? null,
  maxBottom: (verify as { maxBottom?: number }).maxBottom ?? null,
  metrics: (verify as { metrics?: Record<string, unknown> }).metrics ?? null,
  mode,
  part: partIdx + 1,
  partsTotal,
  rowBottom: (verify as { rowBottom?: number }).rowBottom ?? null,
  rowTop: (verify as { rowTop?: number }).rowTop ?? null,
  top,
});

const verifyScrollPart = async (
  handle: ElementHandle,
  mode: string,
  partsTotal: number,
  top: number,
  payloadBase: CapturePayloadBase,
) => {
  await expandCommentForCapture(handle);
  return handle.evaluate(runPayloadOnElement, {
    body: VERIFY_SCRIPT,
    payload: { mode, partsTotal, top, ...payloadBase },
  });
};

const prepareScrollHighlight = async (
  handle: ElementHandle,
  data: CommentRecord,
  partIdx: number,
  lastHash: string | null,
) => {
  const hl = await ensureHighlightReady(handle as never, data);
  if (!hl.ok && partIdx > 0) return { done: true, lastHash };
  await reinforceHighlightStyles(handle);
  return { done: false, lastHash };
};

const clearHighlightNode = (node: Element) => {
  if (!(node instanceof HTMLElement)) return;
  node.style.outline = '';
  node.style.outlineOffset = '';
  node.style.boxShadow = '';
  node.style.backgroundColor = '';
  node.style.backgroundClip = '';
  node.removeAttribute('data-apify-highlight');
};

const cleanupHighlightBrowser = () => {
  document.querySelectorAll('[data-apify-highlight-overlay="1"]').forEach((node) => node.remove());
  document.querySelectorAll('[data-apify-highlight="1"]').forEach(clearHighlightNode);
};

const cleanupHighlightArtifacts = async (page: CapturePage) => {
  await page.evaluate(cleanupHighlightBrowser, undefined as never).catch(() => undefined);
};

const saveScrollPart = async (
  page: CapturePage,
  outDir: string,
  session: CaptureSession,
  partIdx: number,
  lastHash: string | null,
  hashClip?: Record<string, number>,
) => {
  const buffer = await takeScreenshot(page);
  const hashSource = hashClip ? await takeScreenshot(page, hashClip) : buffer;
  const currentHash = hashBuffer(hashSource);
  if (currentHash === lastHash && partIdx > 0) return { duplicated: true, lastHash };
  const suffix = partIdx === 0 ? '' : `-part${partIdx + 1}`;
  await savePart(outDir, session, `${session.screenshotUuid}${suffix}.png`, buffer);
  return { duplicated: false, lastHash: currentHash, bytes: buffer.length, hashBytes: hashSource.length };
};

export const captureScrollPart = async (
  page: CapturePage,
  handle: ElementHandle,
  data: CommentRecord,
  outDir: string,
  session: CaptureSession,
  mode: string,
  commentIndex: number,
  partIdx: number,
  partsTotal: number,
  top: number,
  payloadBase: CapturePayloadBase,
  lastHash: string | null,
  skipHighlight: boolean,
  log: CaptureDebugLog,
): Promise<CapturePartResult> => {
  await log(outDir, commentIndex, 'capture scroll part:start', { mode, part: partIdx + 1, partsTotal, top });
  const verify = await verifyScrollPart(handle, mode, partsTotal, top, payloadBase);
  if (!(verify as { ok?: boolean; reason?: string })?.ok) {
    await log(outDir, commentIndex, 'capture scroll part:verify_failed', { mode, part: partIdx + 1, partsTotal, reason: (verify as { reason?: string })?.reason ?? null, top });
    return { done: true, lastHash };
  }
  await logVerify(log, outDir, commentIndex, partIdx, partsTotal, top, mode, verify);
  await page.waitForTimeout(180);
  if (!skipHighlight) {
    const highlight = await prepareScrollHighlight(handle, data, partIdx, lastHash);
    if (highlight.done) return { done: false, lastHash: highlight.lastHash };
  }
  await page.evaluate(setScreenshotBanner, { text: bannerText(session, page.url(), commentIndex, partIdx + 1, partsTotal) });
  const hashClip = partsTotal > 1 ? (verify as { clip?: Record<string, number> }).clip : undefined;
  const saved = await saveScrollPart(page, outDir, session, partIdx, lastHash, hashClip);
  await cleanupHighlightArtifacts(page);
  if (saved.duplicated) {
    await log(outDir, commentIndex, 'capture scroll part:duplicate_hash', { mode, part: partIdx + 1, partsTotal, top });
    return { done: false, lastHash: saved.lastHash };
  }
  await log(outDir, commentIndex, 'capture scroll part:saved', { mode, part: partIdx + 1, partsTotal, top, bytes: saved.bytes, hashBytes: saved.hashBytes });
  return { done: false, lastHash: saved.lastHash };
};

export const captureScrollSequence = async (
  page: CapturePage,
  handle: ElementHandle,
  data: CommentRecord,
  outDir: string,
  session: CaptureSession,
  commentIndex: number,
  plan: CapturePlan,
  payloadBase: CapturePayloadBase,
  lastHash: string | null,
  skipHighlight: boolean,
  log: CaptureDebugLog,
) => {
  let hash = lastHash;
  let partIdx = 0;
  while (partIdx < plan.scrollParts.length) {
    const top = plan.scrollParts[partIdx] ?? 0;
    const result = await captureScrollPart(page, handle, data, outDir, session, plan.mode, commentIndex, partIdx, plan.scrollParts.length, top, payloadBase, hash, skipHighlight, log);
    if (result.done) return hash;
    hash = result.lastHash;
    partIdx += 1;
  }
  return hash;
};
