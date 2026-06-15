import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LikersBatch } from '../../../schemas/index.ts';

const COLLECT_SCRIPT = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'browser-scripts/collect-likers-dialog.script'),
  'utf8',
);

const DIALOG_OPEN_SCRIPT = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'browser-scripts/dialog-is-open.script'),
  'utf8',
);

const RESET_DIALOG_SCRIPT = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'browser-scripts/reset-likers-dialog.script'),
  'utf8',
);

const SCROLL_END_SCRIPT = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'browser-scripts/scroll-likers-dialog-end.script'),
  'utf8',
);

const NUDGE_END_SCRIPT = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'browser-scripts/nudge-likers-dialog-end.script'),
  'utf8',
);

const OSCILLATE_END_SCRIPT = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'browser-scripts/oscillate-likers-dialog-end.script'),
  'utf8',
);

const mergeBatch = (
  batch: LikersBatch,
  seen: Set<string>,
  likers: Array<{ profileUrl: string; username: string }>,
  maxCommentLikers: number,
) => {
  let added = 0;
  for (const item of batch.items || []) {
    const u = (item.username || '').trim();
    const p = (item.profilePath || '').trim();
    if (!u || !p) continue;
    const key = u.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const profileUrl = p.startsWith('http') ? p : `https://www.instagram.com${p}`;
    likers.push({ profileUrl, username: u });
    added += 1;
    if (maxCommentLikers && likers.length >= maxCommentLikers) break;
  }
  return added;
};

function runIifeBody<T>(args: { body: string }) {
  const source = args.body.trim().replace(/^return\s+/, '').replace(/;\s*$/, '');
  return new Function(`return ${source}`)() as T;
}

const resolveTargetCount = (maxCommentLikers: number, likesCount: number) => {
  if (maxCommentLikers > 0) return Math.min(maxCommentLikers, likesCount || maxCommentLikers);
  return likesCount || 0;
};

const resolveMaxRounds = (maxCommentLikers: number, likesCount: number) => {
  const target = resolveTargetCount(maxCommentLikers, likesCount);
  if (target >= 50) return Math.min(300, Math.max(80, Math.ceil(target / 2)));
  if (maxCommentLikers === 0) return 240;
  return 60;
};

export const resetLikersDialogScroll = async (
  page: {
    evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
    waitForTimeout: (ms: number) => Promise<void>;
  },
) => {
  await page.evaluate(runIifeBody<boolean>, { body: RESET_DIALOG_SCRIPT });
  await page.waitForTimeout(120);
};

export const scrollLikersDialogToEnd = async (
  page: {
    evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
    waitForTimeout: (ms: number) => Promise<void>;
  },
) => {
  await page.evaluate(runIifeBody<boolean>, { body: SCROLL_END_SCRIPT });
  await page.waitForTimeout(180);
};

export const nudgeLikersDialogAtEnd = async (
  page: {
    evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
    waitForTimeout: (ms: number) => Promise<void>;
  },
) => {
  await page.evaluate(runIifeBody<boolean>, { body: NUDGE_END_SCRIPT });
  await page.waitForTimeout(220);
};

export const oscillateLikersDialogAtEnd = async (
  page: {
    evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
    waitForTimeout: (ms: number) => Promise<void>;
  },
) => {
  await page.evaluate(runIifeBody<boolean>, { body: OSCILLATE_END_SCRIPT });
  await page.waitForTimeout(280);
};

type CollectDialogPage = {
  evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
  waitForTimeout: (ms: number) => Promise<void>;
  keyboard?: { press: (key: string) => Promise<void> };
};

const likerGap = (targetCount: number, collected: number) => {
  if (targetCount <= 0) return 0;
  return Math.max(0, targetCount - collected);
};

const resolveMaxRewinds = (targetCount: number, collected: number) => {
  const gap = likerGap(targetCount, collected);
  if (gap <= 0) return 0;
  if (gap === 1) return 2;
  if (gap <= 2) return 2;
  if (gap <= 5) return 2;
  return 1;
};

const isNearTarget = (targetCount: number, collected: number) =>
  targetCount > 0 && collected >= targetCount - 2 && collected < targetCount;

const isLikelyUnrecoverableGap = (targetCount: number, collected: number, failedRewinds: number) => {
  const gap = likerGap(targetCount, collected);
  if (gap <= 0) return true;
  if (gap === 1) return failedRewinds >= 2;
  if (gap === 2) return failedRewinds >= 2;
  return false;
};

const collectVisibleBatch = async (page: CollectDialogPage) =>
  page.evaluate(runIifeBody<LikersBatch>, { body: COLLECT_SCRIPT });

const collectTailWithNudge = async (
  page: CollectDialogPage,
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

const finalizeNearTarget = async (
  page: CollectDialogPage,
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

export const collectLikersFromDialog = async (
  page: CollectDialogPage,
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
