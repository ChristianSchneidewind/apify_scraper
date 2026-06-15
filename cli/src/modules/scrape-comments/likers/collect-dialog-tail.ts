import type { LikersBatch } from '../../../schemas/index.ts';
import {
  COLLECT_SCRIPT,
  isLikelyUnrecoverableGap,
  likerGap,
  mergeBatch,
  resolveMaxRewinds,
  runIifeBody,
} from './collect-dialog-utils.ts';
import {
  nudgeLikersDialogAtEnd,
  oscillateLikersDialogAtEnd,
  resetLikersDialogScroll,
  scrollLikersDialogToEnd,
} from './collect-dialog-scroll.ts';

const collectVisibleBatch = async (page: {
  evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
}) =>
  page.evaluate(runIifeBody<LikersBatch>, { body: COLLECT_SCRIPT });

export const collectTailWithNudge = async (
  page: {
    evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
    waitForTimeout: (ms: number) => Promise<void>;
  },
  seen: Set<string>,
  likers: Array<{ profileUrl: string; username: string }>,
  maxCommentLikers: number,
  targetCount = 0,
) => {
  const gap = likerGap(targetCount, likers.length);
  const passes = gap === 1 ? 3 : 2;
  for (let pass = 0; pass < passes; pass += 1) {
    await scrollLikersDialogToEnd(page);
    if (pass > 0) await oscillateLikersDialogAtEnd(page);
    await nudgeLikersDialogAtEnd(page);
    await page.waitForTimeout(pass === 0 ? 180 : 320);
    const endBatch = await collectVisibleBatch(page);
    if (!endBatch?.open) continue;
    mergeBatch(endBatch, seen, likers, maxCommentLikers);
    if (targetCount > 0 && likers.length >= targetCount) return;
  }
};

export const finalizeNearTarget = async (
  page: {
    evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
    waitForTimeout: (ms: number) => Promise<void>;
  },
  seen: Set<string>,
  likers: Array<{ profileUrl: string; username: string }>,
  maxCommentLikers: number,
  targetCount: number,
) => {
  if (targetCount <= 0 || likers.length >= targetCount) return;

  await collectTailWithNudge(page, seen, likers, maxCommentLikers, targetCount);
  if (likers.length >= targetCount) return;

  const maxRewinds = resolveMaxRewinds(targetCount, likers.length);
  let failedRewinds = 0;
  for (let attempt = 0; attempt < maxRewinds && likers.length < targetCount; attempt += 1) {
    const before = likers.length;
    await resetLikersDialogScroll(page);
    for (let round = 0; round < 24 && likers.length < targetCount; round += 1) {
      const batch = await collectVisibleBatch(page);
      if (!batch?.open) break;
      const added = mergeBatch(batch, seen, likers, maxCommentLikers);
      if (added === 0 && !batch.canScroll) break;
      if (batch.canScroll) continue;
      await collectTailWithNudge(page, seen, likers, maxCommentLikers, targetCount);
      break;
    }
    if (likers.length <= before) {
      failedRewinds += 1;
      if (isLikelyUnrecoverableGap(targetCount, likers.length, failedRewinds)) break;
    } else {
      failedRewinds = 0;
    }
  }
};