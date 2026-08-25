import type {
  CapturePage,
  CapturePayloadBase,
  CapturePlan,
  CaptureSession,
  CommentRecord,
  ElementHandle,
} from '../../../schemas/index.ts';
import { captureQuickCommentScreenshot, writeMetadata } from './assets.ts';
import { verifyCaptureVisibility } from './visibility.ts';
import { verifyMultipartBrowser } from '../multipart/browser.ts';
import { expandCommentForCapture, planCommentMultipart } from '../multipart/planner.ts';
import { estimateRowParts } from '../multipart/decisions.ts';
import { logCaptureDebug } from './log.ts';
import { captureScrollSequence } from './scroll.ts';

const buildPayloadBase = (data: CommentRecord): CapturePayloadBase => ({
  commentPermalink: data.commentPermalink,
  text: data.text,
  userProfilePath: data.userProfilePath,
  username: data.username,
});

const logPlan = (outDir: string, commentIndex: number, plan: CapturePlan) =>
  logCaptureDebug(outDir, commentIndex, 'capture plan', {
    baseSig: plan.baseSig,
    mode: plan.mode,
    plannedParts3plus: plan.plannedParts3plus,
    scrollParts: plan.scrollParts,
    totalParts: plan.totalParts,
    use3plusRoute: plan.use3plusRoute,
  });

const escalatePlan = async (
  outDir: string,
  commentIndex: number,
  plan: CapturePlan,
  parts: number,
  overflow: number,
) => {
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
    overflow,
    parts,
    toMode: escalated.mode,
  });
  return escalated;
};

const maybeEscalateSinglePlan = async (
  handle: ElementHandle,
  outDir: string,
  commentIndex: number,
  plan: CapturePlan,
  payloadBase: CapturePayloadBase,
) => {
  if (plan.mode !== 'single' || plan.totalParts !== 1) return plan;
  const probe = await handle.evaluate(verifyMultipartBrowser, {
    mode: 'single', partsTotal: 1, top: 0, ...payloadBase,
  });
  const metrics = probe.metrics;
  const overflow = Math.max(0, metrics?.overflow ?? 0);
  const clippedBottom = Boolean(probe.clippedBottom);
  const clippedTop = Boolean(probe.clippedTop);
  await logCaptureDebug(outDir, commentIndex, 'capture single probe', { clippedBottom, clippedTop, metrics: metrics ?? null, overflow });
  if (!clippedBottom && !clippedTop && overflow <= 24) return plan;
  const parts = estimateRowParts(metrics);
  if (parts <= 1) return plan;
  return escalatePlan(outDir, commentIndex, plan, parts, overflow);
};

const captureQuick = async (
  page: CapturePage,
  handle: ElementHandle,
  data: CommentRecord,
  outDir: string,
  session: CaptureSession,
  commentIndex: number,
  lastHash: string | null,
  visibleInViewport: boolean,
) => {
  const quick = await captureQuickCommentScreenshot(page, handle, data, outDir, session, commentIndex, lastHash, visibleInViewport);
  return { incompleteReason: null, lastScreenshotHash: quick.lastScreenshotHash, metadataPath: quick.metadataPath, plannedParts: null, screenshotKeys: session.screenshotKeys, screenshotPaths: session.screenshotPaths };
};

const capturePlanned = async (
  page: CapturePage,
  handle: ElementHandle,
  data: CommentRecord,
  outDir: string,
  session: CaptureSession,
  commentIndex: number,
  lastHash: string | null,
  skipHighlight: boolean,
) => {
  const payloadBase = buildPayloadBase(data);
  let plan: CapturePlan = await planCommentMultipart(handle, data);
  plan = await maybeEscalateSinglePlan(handle, outDir, commentIndex, plan, payloadBase);
  session.plannedParts = plan.totalParts;
  await logPlan(outDir, commentIndex, plan);
  if (plan.totalParts > 1) await expandCommentForCapture(handle);
  await logCaptureDebug(outDir, commentIndex, 'capture route', { clip: false, mode: plan.mode, route: 'scroll' });
  return captureScrollSequence(page, handle, data, outDir, session, commentIndex, plan, payloadBase, lastHash, skipHighlight, logCaptureDebug);
};

export const captureCommentAssets = async (
  page: CapturePage,
  handle: ElementHandle,
  data: CommentRecord,
  outDir: string,
  session: CaptureSession,
  commentIndex: number,
  lastHash: string | null,
  skipHighlight = false,
) => {
  const visibleId = data.commentPermalink || `comment-${commentIndex}`;
  const visibleInViewport = await verifyCaptureVisibility(handle, visibleId);
  if (skipHighlight) return captureQuick(page, handle, data, outDir, session, commentIndex, lastHash, visibleInViewport);
  const lastScreenshotHash = await capturePlanned(page, handle, data, outDir, session, commentIndex, lastHash, skipHighlight);
  const metadataPath = await writeMetadata(page, outDir, data, commentIndex, session, visibleInViewport);
  await logCaptureDebug(outDir, commentIndex, 'capture done', { metadataPath, partsSaved: session.screenshotKeys.length, visibleInViewport });
  return { incompleteReason: session.incompleteReason ?? null, lastScreenshotHash, metadataPath, plannedParts: session.plannedParts ?? null, screenshotKeys: session.screenshotKeys, screenshotPaths: session.screenshotPaths };
};
