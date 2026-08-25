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
  MultipartVerifyResult,
  ScreenshotClip,
} from '../../../schemas/index.ts';
import { verifyMultipartBrowser } from '../multipart/browser.ts';
import { expandCommentForCapture } from '../multipart/planner.ts';
import { refindCommentRowHandle } from '../extract-from-locator.ts';
import { bannerText, setScreenshotBanner } from './banner.ts';
import { hashBuffer, savePart, takeScreenshot } from './assets.ts';
import { reinforceHighlightStyles } from './highlight-style.ts';

const logVerify = async (
  log: CaptureDebugLog,
  outDir: string,
  commentIndex: number,
  partIdx: number,
  partsTotal: number,
  top: number,
  mode: string,
  verify: MultipartVerifyResult,
) => log(outDir, commentIndex, 'capture scroll part:verify', {
  clip: verify.clip ?? null,
  debug: null,
  maxBottom: verify.maxBottom ?? null,
  metrics: verify.metrics ?? null,
  mode,
  part: partIdx + 1,
  partsTotal,
  rowBottom: verify.rowBottom ?? null,
  rowTop: verify.rowTop ?? null,
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
  return handle.evaluate(verifyMultipartBrowser, {
    mode, partsTotal, top, ...payloadBase,
  });
};

// Re-apply the highlight after the verify scroll: scrollport nudges can make
// Instagram replace the row node between parts, which drops the outline.
// A failed highlight is flagged in the debug log but never aborts the
// sequence — a part without frame beats a missing comment end.
const prepareScrollHighlight = async (
  handle: ElementHandle,
  data: CommentRecord,
) => {
  const hl = await ensureHighlightReady(handle, data);
  if (!hl.ok) return { highlighted: false, reason: hl.reason ?? 'unknown' };
  await reinforceHighlightStyles(handle);
  return { highlighted: true };
};

const cleanupHighlightBrowser = () => {
  document.querySelectorAll('[data-apify-highlight-overlay="1"]').forEach((node) => node.remove());
  document.querySelectorAll<HTMLElement>('[data-apify-highlight="1"]').forEach((node) => {
    node.style.outline = '';
    node.style.outlineOffset = '';
    node.style.boxShadow = '';
    node.style.backgroundColor = '';
    node.style.backgroundClip = '';
    node.removeAttribute('data-apify-highlight');
  });
};

const cleanupHighlightArtifacts = async (page: CapturePage) => {
  await page.evaluate(cleanupHighlightBrowser, undefined).catch(() => undefined);
};

const saveScrollPart = async (
  page: CapturePage,
  outDir: string,
  session: CaptureSession,
  partIdx: number,
  lastHash: string | null,
  hashClip?: ScreenshotClip,
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
  if (!verify.ok) {
    const reason = verify.reason ?? 'unknown';
    await log(outDir, commentIndex, 'capture scroll part:verify_failed', { mode, part: partIdx + 1, partsTotal, reason, top });
    session.incompleteReason = `verify_failed:${reason}`;
    // A detached row (Instagram re-renders the list on scroll) is worth a
    // refind+retry; other failures end the sequence.
    return { done: true, lastHash, retryable: reason === 'row_not_found' };
  }
  await logVerify(log, outDir, commentIndex, partIdx, partsTotal, top, mode, verify);
  await page.waitForTimeout(180);
  const highlight = skipHighlight ? null : await prepareScrollHighlight(handle, data);
  if (highlight && !highlight.highlighted) await log(outDir, commentIndex, 'capture scroll part:highlight_failed', { mode, part: partIdx + 1, partsTotal, reason: highlight.reason ?? null, top });
  await page.evaluate(setScreenshotBanner, { text: bannerText(session, page.url(), commentIndex, partIdx + 1, partsTotal) });
  const hashClip = partsTotal > 1 ? verify.clip : undefined;
  const saved = await saveScrollPart(page, outDir, session, partIdx, lastHash, hashClip);
  await cleanupHighlightArtifacts(page);
  if (saved.duplicated) {
    // A deduped part added no new pixels (scroll no-op): count it as
    // covered, not as missing, so the review flag stays quiet.
    session.dedupedParts = (session.dedupedParts ?? 0) + 1;
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
  let rowHandle = handle;
  let refinds = 0;
  while (partIdx < plan.scrollParts.length) {
    const top = plan.scrollParts[partIdx] ?? 0;
    const result = await captureScrollPart(page, rowHandle, data, outDir, session, plan.mode, commentIndex, partIdx, plan.scrollParts.length, top, payloadBase, hash, skipHighlight, log);
    const canRefind = Boolean(result.done && result.retryable && refinds < 2 && !skipHighlight);
    const refound = canRefind ? await refindCommentRowHandle(page, payloadBase).catch(() => null) : null;
    if (canRefind && !refound) await log(outDir, commentIndex, 'capture scroll part:refind_failed', { mode: plan.mode, part: partIdx + 1, partsTotal: plan.scrollParts.length, top });
    if (refound) { refinds += 1; rowHandle = refound; session.incompleteReason = null; await log(outDir, commentIndex, 'capture scroll part:refound', { mode: plan.mode, part: partIdx + 1, partsTotal: plan.scrollParts.length, refinds, top }); continue; }
    if (result.done) return hash;
    hash = result.lastHash;
    partIdx += 1;
  }
  return hash;
};
