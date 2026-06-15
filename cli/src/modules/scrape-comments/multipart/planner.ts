import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSafeClickHelpers } from '../../../adapters/instagram/safe-click.ts';
import { injectHelpers } from '../../../adapters/instagram/load-script.ts';
import type { CommentRecord, ElementHandle, MultipartPlanResult } from '../../../schemas/index.ts';
import {
  calcForcedParts,
  shouldForceRowMultipart,
  shouldUse3PlusRoute,
  totalParts,
} from './decisions.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const PLAN_SCRIPT = readFileSync(join(dir, 'browser-scripts/multipart-plan.script'), 'utf8');
const EXPAND_SCRIPT = injectHelpers(
  readFileSync(join(dir, 'browser-scripts/multipart-expand.script'), 'utf8'),
  buildSafeClickHelpers(),
);

const buildPayload = (data: CommentRecord) => ({
  commentPermalink: data.commentPermalink,
  text: data.text,
  userProfilePath: data.userProfilePath,
  username: data.username,
});

export const expandCommentForCapture = async (handle: ElementHandle) => {
  await handle.evaluate((el: Element, args: { body: string }) => new Function('el', args.body)(el), { body: EXPAND_SCRIPT });
};

export const planCommentMultipart = async (
  handle: ElementHandle,
  data: CommentRecord,
) => {
  await expandCommentForCapture(handle);

  const partPlan = await handle.evaluate((el: Element, args: { body: string; payload: Record<string, unknown> }) => {
    const fn = new Function(args.body)() as (payload: Record<string, unknown>) => MultipartPlanResult;
    return fn({ ...args.payload, el });
  }, {
    body: PLAN_SCRIPT,
    payload: buildPayload(data),
  });
  const safePlan = partPlan?.ok ? partPlan : { mode: 'single', tops: [0], sig: null };

  let scrollParts = safePlan.tops || [0];
  let mode = safePlan.mode || 'single';
  const textLen = (data.text || '').trim().length;

  if (shouldForceRowMultipart(textLen, mode)) {
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
