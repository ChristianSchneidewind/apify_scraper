import type { LikersBatch } from '../../../schemas/index.ts';
import {
  COLLECT_SCRIPT,
  DIALOG_OPEN_SCRIPT,
  isLikelyUnrecoverableGap,
  isNearTarget,
  mergeBatch,
  resolveMaxRewinds,
  resolveMaxRounds,
  resolveTargetCount,
  runIifeBody,
} from './collect-dialog-utils.ts';
import { resetLikersDialogScroll } from './collect-dialog-scroll.ts';
import { collectTailWithNudge, finalizeNearTarget } from './collect-dialog-tail.ts';

export {
  nudgeLikersDialogAtEnd,
  oscillateLikersDialogAtEnd,
  resetLikersDialogScroll,
  scrollLikersDialogToEnd,
} from './collect-dialog-scroll.ts';

const collectVisibleBatch = async (page: {
  evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
}) =>
  page.evaluate(runIifeBody<LikersBatch>, { body: COLLECT_SCRIPT });

export const collectLikersFromDialog = async (
  page: {
    evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
    waitForTimeout: (ms: number) => Promise<void>;
    keyboard?: { press: (key: string) => Promise<void> };
  },
  maxCommentLikers: number,
  verbose?: boolean,
  likesCount = 0,
  signal?: AbortSignal,
) => {
  const likers: Array<{ profileUrl: string; username: string }> = [];
  const seen = new Set<string>();
  const targetCount = resolveTargetCount(maxCommentLikers, likesCount);
  const maxRounds = resolveMaxRounds(maxCommentLikers, likesCount);
  const maxStagnant = maxCommentLikers === 0 ? 8 : 3;
  let stagnant = 0;
  let rewindAttempts = 0;
  let failedRewinds = 0;
  const maxRewinds = resolveMaxRewinds(targetCount, 0);

  await resetLikersDialogScroll(page);

  for (let round = 0; round < maxRounds; round += 1) {
    if (signal?.aborted) break;
    const batch = await collectVisibleBatch(page);
    if (!(batch as LikersBatch)?.open) break;
    const added = mergeBatch(batch as LikersBatch, seen, likers, maxCommentLikers);
    if (verbose) {
      const summary = batch as LikersBatch & { candidateCount?: number; targetCount?: number; targetIndex?: number; summary?: unknown };
      process.stderr.write(`[scrape.comments][likers][debug] round=${round} open=${Boolean(summary.open)} viewport=${(summary.items || []).length} added=${added} total=${likers.length} canScroll=${Boolean(summary.canScroll)} candidates=${summary.candidateCount ?? 'n/a'} targets=${summary.targetCount ?? 'n/a'} targetIndex=${summary.targetIndex ?? 'n/a'} summary=${JSON.stringify(summary.summary ?? null)}\n`);
    }
    if (maxCommentLikers && likers.length >= maxCommentLikers) break;
    if (targetCount > 0 && likers.length >= targetCount) break;
    stagnant = added === 0 ? stagnant + 1 : 0;
    if (stagnant > 0 && page.keyboard?.press) {
      await Promise.allSettled([
        page.keyboard.press(batch.canScroll ? 'PageDown' : 'End'),
      ]);
    }
    if (!(batch as LikersBatch).canScroll && stagnant >= maxStagnant) {
      if (isNearTarget(targetCount, likers.length) && rewindAttempts < maxRewinds) {
        const before = likers.length;
        rewindAttempts += 1;
        stagnant = 0;
        await resetLikersDialogScroll(page);
        if (rewindAttempts === 1) {
          await collectTailWithNudge(page, seen, likers, maxCommentLikers, targetCount);
          if (likers.length >= targetCount) break;
        }
        if (likers.length <= before) {
          failedRewinds += 1;
          if (isLikelyUnrecoverableGap(targetCount, likers.length, failedRewinds)) break;
        } else {
          failedRewinds = 0;
        }
        continue;
      }
      break;
    }
    await page.waitForTimeout(maxCommentLikers === 0 ? 280 : 220);
  }

  if (!signal?.aborted) {
    await finalizeNearTarget(page, seen, likers, maxCommentLikers, targetCount);
  }
  return likers;
};

export const isDialogOpen = async (
  page: {
    evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
  },
) => page.evaluate(runIifeBody<boolean>, { body: DIALOG_OPEN_SCRIPT });

export const waitForDialogOpen = async (
  page: {
    evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
    waitForTimeout: (ms: number) => Promise<void>;
  },
) => {
  for (let i = 0; i < 20; i += 1) {
    const open = await page.evaluate(runIifeBody<boolean>, { body: DIALOG_OPEN_SCRIPT });
    if (open) return true;
    await page.waitForTimeout(180);
  }
  return false;
};
