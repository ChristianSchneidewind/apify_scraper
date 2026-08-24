import type { CommentRecord, ElementHandle, RefindCommentPayload } from '../../../schemas/index.ts';
import {
  calcForcedParts,
  hasMultipartEvidence,
  shouldForceRowMultipart,
  shouldUse3PlusRoute,
  totalParts,
} from './decisions.ts';

import { expandCommentBrowser, planMultipartBrowser } from './browser.ts';

const buildPayload = (data: CommentRecord): RefindCommentPayload => ({
  commentPermalink: data.commentPermalink,
  text: data.text,
  userProfilePath: data.userProfilePath,
  username: data.username,
});

export const expandCommentForCapture = async (handle: ElementHandle) => {
  await handle.evaluate(expandCommentBrowser, undefined);
};

export const planCommentMultipart = async (
  handle: ElementHandle,
  data: CommentRecord,
) => {
  const partPlan = await handle.evaluate(planMultipartBrowser, buildPayload(data));
  const safePlan = partPlan?.ok ? partPlan : { mode: 'single', tops: [0], sig: null };

  let scrollParts = safePlan.tops || [0];
  let mode = safePlan.mode || 'single';
  const metrics = safePlan.metrics;
  const textLen = (data.text || '').trim().length;

  if (!hasMultipartEvidence(mode, scrollParts, metrics)) {
    mode = 'single';
    scrollParts = [0];
  }

  if (shouldForceRowMultipart(textLen, mode, metrics)) {
    mode = 'row';
    scrollParts = Array.from({ length: calcForcedParts(textLen) }, (_, i) => i);
  }

  const parts = totalParts(scrollParts);
  return {
    baseSig: safePlan.sig ?? null,
    mode,
    plannedParts3plus: parts,
    scrollParts,
    totalParts: parts,
    use3plusRoute: shouldUse3PlusRoute(parts),
  };
};
