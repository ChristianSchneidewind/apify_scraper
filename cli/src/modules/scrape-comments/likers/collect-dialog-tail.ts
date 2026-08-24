import type { CommentLiker, LikersDialogPage } from '../../../schemas/index.ts';
import {
  isLikelyUnrecoverableGap,
  likerGap,
  mergeBatch,
  resolveMaxRewinds,
} from './collect-dialog-utils.ts';
import { collectLikersDialogBatch } from './browser.ts';
import {
  nudgeLikersDialogAtEnd,
  oscillateLikersDialogAtEnd,
  resetLikersDialogScroll,
  scrollLikersDialogToEnd,
} from './collect-dialog-scroll.ts';

const collectVisibleBatch = async (page: LikersDialogPage) => page.evaluate(collectLikersDialogBatch, undefined);

export const collectTailWithNudge = async (
  page: LikersDialogPage,
  seen: Set<string>,
  likers: CommentLiker[],
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

const collectRewindRound = async (
  page: LikersDialogPage,
  seen: Set<string>,
  likers: CommentLiker[],
  maxCommentLikers: number,
  targetCount: number,
) => {
  const batch = await collectVisibleBatch(page);
  if (!batch?.open) return false;
  const added = mergeBatch(batch, seen, likers, maxCommentLikers);
  if (added === 0 && !batch.canScroll) return false;
  if (batch.canScroll) return true;
  await collectTailWithNudge(page, seen, likers, maxCommentLikers, targetCount);
  return false;
};

const nextFailedRewinds = (current: number, before: number, failedRewinds: number) =>
  current > before ? 0 : failedRewinds + 1;

const runRewindRounds = async (
  page: LikersDialogPage,
  seen: Set<string>,
  likers: CommentLiker[],
  maxCommentLikers: number,
  targetCount: number,
) => {
  for (let round = 0; round < 24 && likers.length < targetCount; round += 1) {
    const keepGoing = await collectRewindRound(page, seen, likers, maxCommentLikers, targetCount);
    if (!keepGoing) break;
  }
};

export const finalizeNearTarget = async (
  page: LikersDialogPage,
  seen: Set<string>,
  likers: CommentLiker[],
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
    await runRewindRounds(page, seen, likers, maxCommentLikers, targetCount);
    failedRewinds = nextFailedRewinds(likers.length, before, failedRewinds);
    if (likers.length <= before && isLikelyUnrecoverableGap(targetCount, likers.length, failedRewinds)) break;
  }
};
