import type { CommentLiker, LikersBatch, LikersDialogPage } from '../../../schemas/index.ts';
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
}) => page.evaluate(runIifeBody<LikersBatch>, { body: COLLECT_SCRIPT });

const logRoundDebug = (
  verbose: boolean | undefined,
  round: number,
  batch: LikersBatch,
  added: number,
  total: number,
) => {
  if (!verbose) return;
  const summary = batch as LikersBatch & { candidateCount?: number; targetCount?: number; targetIndex?: number; summary?: unknown };
  process.stderr.write(`[scrape.comments][likers][debug] round=${round} open=${Boolean(summary.open)} viewport=${(summary.items || []).length} added=${added} total=${total} canScroll=${Boolean(summary.canScroll)} candidates=${summary.candidateCount ?? 'n/a'} targets=${summary.targetCount ?? 'n/a'} targetIndex=${summary.targetIndex ?? 'n/a'} summary=${JSON.stringify(summary.summary ?? null)}\n`);
};

const shouldStopAfterBatch = (
  likers: CommentLiker[],
  maxCommentLikers: number,
  targetCount: number,
) => {
  if (maxCommentLikers && likers.length >= maxCommentLikers) return true;
  return targetCount > 0 && likers.length >= targetCount;
};

const tryNearTargetRewind = async (
  page: LikersDialogPage,
  seen: Set<string>,
  likers: CommentLiker[],
  maxCommentLikers: number,
  targetCount: number,
  rewindAttempts: number,
  failedRewinds: number,
) => {
  const before = likers.length;
  const nextRewindAttempts = rewindAttempts + 1;
  await resetLikersDialogScroll(page);
  if (nextRewindAttempts === 1) await collectTailWithNudge(page, seen, likers, maxCommentLikers, targetCount);
  if (likers.length >= targetCount) return { failedRewinds, rewindAttempts: nextRewindAttempts, stop: true };
  if (likers.length > before) return { failedRewinds: 0, rewindAttempts: nextRewindAttempts, stop: false };
  const nextFailedRewinds = failedRewinds + 1;
  return {
    failedRewinds: nextFailedRewinds,
    rewindAttempts: nextRewindAttempts,
    stop: isLikelyUnrecoverableGap(targetCount, likers.length, nextFailedRewinds),
  };
};

const handleStagnantEnd = async (
  page: LikersDialogPage,
  seen: Set<string>,
  likers: CommentLiker[],
  maxCommentLikers: number,
  targetCount: number,
  rewindAttempts: number,
  failedRewinds: number,
) => {
  const maxRewinds = resolveMaxRewinds(targetCount, 0);
  if (!isNearTarget(targetCount, likers.length) || rewindAttempts >= maxRewinds) return { failedRewinds, rewindAttempts, shouldBreak: true };
  const rewind = await tryNearTargetRewind(page, seen, likers, maxCommentLikers, targetCount, rewindAttempts, failedRewinds);
  return { failedRewinds: rewind.failedRewinds, rewindAttempts: rewind.rewindAttempts, shouldBreak: rewind.stop };
};

export const collectLikersFromDialog = async (
  page: LikersDialogPage,
  maxCommentLikers: number,
  verbose?: boolean,
  likesCount = 0,
  signal?: AbortSignal,
) => {
  const likers: CommentLiker[] = [];
  const seen = new Set<string>();
  const targetCount = resolveTargetCount(maxCommentLikers, likesCount);
  const maxRounds = resolveMaxRounds(maxCommentLikers, likesCount);
  const maxStagnant = maxCommentLikers === 0 ? 8 : 3;
  let stagnant = 0;
  let rewindAttempts = 0;
  let failedRewinds = 0;

  await resetLikersDialogScroll(page);

  for (let round = 0; round < maxRounds; round += 1) {
    if (signal?.aborted) break;
    const batch = await collectVisibleBatch(page);
    if (!batch?.open) break;
    const added = mergeBatch(batch, seen, likers, maxCommentLikers);
    logRoundDebug(verbose, round, batch, added, likers.length);
    if (shouldStopAfterBatch(likers, maxCommentLikers, targetCount)) break;
    stagnant = added === 0 ? stagnant + 1 : 0;
    if (stagnant > 0 && page.keyboard?.press) await page.keyboard.press(batch.canScroll ? 'PageDown' : 'End').catch(() => undefined);
    const rewind = !batch.canScroll && stagnant >= maxStagnant ? await handleStagnantEnd(page, seen, likers, maxCommentLikers, targetCount, rewindAttempts, failedRewinds) : null;
    rewindAttempts = rewind?.rewindAttempts ?? rewindAttempts;
    failedRewinds = rewind?.failedRewinds ?? failedRewinds;
    stagnant = rewind ? 0 : stagnant;
    if (rewind?.shouldBreak) break;
    if (rewind) continue;
    await page.waitForTimeout(maxCommentLikers === 0 ? 280 : 220);
  }

  if (!signal?.aborted) await finalizeNearTarget(page, seen, likers, maxCommentLikers, targetCount);
  return likers;
};

export const isDialogOpen = async (page: {
  evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
}) => page.evaluate(runIifeBody<boolean>, { body: DIALOG_OPEN_SCRIPT });

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
