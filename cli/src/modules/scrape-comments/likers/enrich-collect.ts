import type { CommentLiker, LikersPage } from '../../../schemas/index.ts';
import { normalizeCommentLikers } from '../comment-state.ts';
import { collectLikersFromDialog, nudgeLikersDialogAtEnd, oscillateLikersDialogAtEnd, resetLikersDialogScroll, scrollLikersDialogToEnd } from './collect-dialog.ts';
import { hasEnoughLikers, resolveLikerTarget } from './enrich-cache.ts';

const collectSessions = new WeakMap<object, { abort: AbortController }>();

const beginCollectSession = (page: LikersPage) => {
  const prev = collectSessions.get(page);
  prev?.abort.abort();
  const session = { abort: new AbortController() };
  collectSessions.set(page, session);
  return session;
};

const endCollectSession = (page: LikersPage, session: { abort: AbortController }) => {
  if (collectSessions.get(page) === session) collectSessions.delete(page);
};

const collectLikersTimed = async (
  page: LikersPage,
  maxCommentLikers: number,
  likesCount: number,
  verbose: boolean | undefined,
  timeoutMs: number,
  session: { abort: AbortController },
) => {
  const timeoutAbort = new AbortController();
  const onSessionAbort = () => timeoutAbort.abort();
  session.abort.signal.addEventListener('abort', onSessionAbort);
  const timer = setTimeout(() => timeoutAbort.abort(), timeoutMs);
  const mergedSignal = timeoutAbort.signal;
  try {
    return await collectLikersFromDialog(page as never, maxCommentLikers, verbose, likesCount, mergedSignal);
  } finally {
    clearTimeout(timer);
    session.abort.signal.removeEventListener('abort', onSessionAbort);
  }
};

const likerCollectTimeoutMs = (likesCount: number, maxCommentLikers: number) => {
  const target = resolveLikerTarget(likesCount, maxCommentLikers);
  if (target <= 0) return maxCommentLikers === 0 ? 12000 : 5000;
  return Math.min(120000, Math.max(8000, target * 180 + 3000));
};

const likerGap = (likesCount: number, maxCommentLikers: number, collected: number) => {
  const target = resolveLikerTarget(likesCount, maxCommentLikers);
  if (target <= 0) return 0;
  return Math.max(0, target - collected);
};

const resolveRetryAttempts = (
  likesCount: number,
  maxCommentLikers: number,
  collected: number,
  initialTimeoutMs: number,
  config?: { retryAttempts?: number; retryDelayMs?: number; timeoutMs?: number },
): Array<[number, number]> => {
  const missing = likerGap(likesCount, maxCommentLikers, collected);
  const retryTimeoutMs = Math.max(initialTimeoutMs, 8000);
  if (config) {
    const count = Math.max(0, Math.floor(config.retryAttempts ?? 3));
    const delay = Math.max(0, config.retryDelayMs ?? 1200);
    const timeout = Math.max(1000, config.timeoutMs ?? retryTimeoutMs);
    return Array.from({ length: count }, (_, index) => [Math.min(30000, delay * (2 ** index)), timeout] as [number, number]);
  }
  const isLargeDialog = likesCount >= 50 || maxCommentLikers === 0;

  if (missing <= 1) {
    return [[1200, Math.min(retryTimeoutMs, 12000)], [900, Math.min(retryTimeoutMs, 12000)]];
  }
  if (missing <= 3) {
    return [[1400, retryTimeoutMs], [800, retryTimeoutMs]];
  }
  if (isLargeDialog) {
    return [[1400, retryTimeoutMs], [1200, retryTimeoutMs], [800, retryTimeoutMs]];
  }
  return [[1200, retryTimeoutMs], [500, Math.max(5000, retryTimeoutMs)]];
};

const scrollDialogBrowser = () => {
  const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
  const dialog = dialogs[dialogs.length - 1];
  if (!dialog) return;
  const candidates = Array.from(dialog.querySelectorAll('div, ul')) as Array<Element & { scrollHeight: number; clientHeight: number; scrollTop: number }>;
  const target = candidates.find((candidate) => candidate.scrollHeight > candidate.clientHeight + 20);
  if (target) target.scrollTop += Math.max(300, target.clientHeight * 0.9);
};

const retryDialogScroll = async (page: LikersPage) => {
  const tasks = [page.evaluate(scrollDialogBrowser, undefined as never), scrollLikersDialogToEnd(page as never), oscillateLikersDialogAtEnd(page as never), nudgeLikersDialogAtEnd(page as never)];
  await Promise.allSettled(tasks);
};

const collectLikersAttempt = async (
  page: LikersPage,
  maxCommentLikers: number,
  likesCount: number,
  waitMs: number,
  timeoutMs: number,
  session: { abort: AbortController },
  verbose?: boolean,
  seedLikers: CommentLiker[] = [],
) => {
  if (waitMs > 0) await page.waitForTimeout(waitMs);
  await Promise.allSettled([retryDialogScroll(page), resetLikersDialogScroll(page as never)]);
  await page.waitForTimeout(700);
  const result = normalizeCommentLikers(
    await collectLikersTimed(page, maxCommentLikers, likesCount, verbose, timeoutMs, session),
  );
  if (!seedLikers.length) {
    if (verbose) process.stderr.write(`[scrape.comments][likers][debug] attempt wait=${waitMs} timeout=${timeoutMs} result=${result.length}\n`);
    return result;
  }
  const merged = normalizeCommentLikers([...seedLikers, ...result]);
  const out = merged.length > result.length ? merged : result;
  if (verbose) {
    process.stderr.write(`[scrape.comments][likers][debug] attempt wait=${waitMs} timeout=${timeoutMs} result=${out.length}\n`);
  }
  return out;
};

const noProgressGap = (
  likers: CommentLiker[],
  likesCount: number,
  maxCommentLikers: number,
  streak: number,
) => {
  const missing = likerGap(likesCount, maxCommentLikers, likers.length);
  return likers.length > 0 && missing <= 3 && streak >= 2 ? missing : null;
};

const applyAttemptResult = (
  likers: CommentLiker[],
  next: CommentLiker[],
  likesCount: number,
  maxCommentLikers: number,
  noProgressStreak: number,
  verbose?: boolean,
) => {
  if (next.length > likers.length) return { likers: next, noProgressStreak: 0, stop: false };
  const streak = noProgressStreak + 1;
  const missing = noProgressGap(likers, likesCount, maxCommentLikers, streak);
  if (missing !== null && verbose) process.stderr.write(`[scrape.comments][likers][debug] stop=no_progress gap=${missing} streak=${streak}\n`);
  return { likers, noProgressStreak: streak, stop: missing !== null };
};

const collectLikersWithRetries = async (
  page: LikersPage,
  maxCommentLikers: number,
  likesCount: number,
  likers: CommentLiker[],
  initialTimeoutMs: number,
  session: { abort: AbortController },
  verbose?: boolean,
  config?: { retryAttempts?: number; retryDelayMs?: number; timeoutMs?: number },
) => {
  const attempts = resolveRetryAttempts(likesCount, maxCommentLikers, likers.length, initialTimeoutMs, config);
  let out = likers;
  let noProgressStreak = 0;
  for (const [waitMs, timeoutMs] of attempts) {
    if (session.abort.signal.aborted) break;
    const next = await collectLikersAttempt(page, maxCommentLikers, likesCount, waitMs, timeoutMs, session, verbose, out);
    const updated = applyAttemptResult(out, next, likesCount, maxCommentLikers, noProgressStreak, verbose);
    out = updated.likers;
    noProgressStreak = updated.noProgressStreak;
    if (updated.stop) break;
    if (verbose) process.stderr.write(`[scrape.comments][likers][debug] after attempt result=${out.length} wait=${waitMs} timeout=${timeoutMs}\n`);
    if (hasEnoughLikers(out, likesCount, maxCommentLikers)) break;
  }
  return out;
};

export const collectLikers = async (
  page: LikersPage,
  maxCommentLikers: number,
  likesCount: number,
  verbose?: boolean,
  config?: { retryAttempts?: number; retryDelayMs?: number; timeoutMs?: number },
) => {
  const session = beginCollectSession(page);
  try {
    const initialTimeoutMs = config?.timeoutMs ?? likerCollectTimeoutMs(likesCount, maxCommentLikers);
    let likers = normalizeCommentLikers(await collectLikersTimed(page, maxCommentLikers, likesCount, verbose, initialTimeoutMs, session));
    if (verbose) process.stderr.write(`[scrape.comments][likers][debug] initial result=${likers.length} likesCount=${likesCount} max=${maxCommentLikers} timeout=${initialTimeoutMs}\n`);
    const target = resolveLikerTarget(likesCount, maxCommentLikers);
    if (likers.length > target) return [];
    if (hasEnoughLikers(likers, likesCount, maxCommentLikers) || likesCount <= 0) return likers;
    likers = await collectLikersWithRetries(page, maxCommentLikers, likesCount, likers, initialTimeoutMs, session, verbose, config);
    return likers.length > target ? [] : likers;
  } finally {
    endCollectSession(page, session);
  }
};

export const closeDialog = async (workedPage: LikersPage, likesCount: number, likers: CommentLiker[]) => {
  if (likesCount > 0 && likers.length === 0) await workedPage.waitForTimeout(1000);
  // Escape must only be sent when a nested likes dialog exists. On Reels,
  // the comments panel is often the only role=dialog and Escape closes it.
  const dialogCount = (await Promise.resolve(workedPage.evaluate(
    () => document.querySelectorAll('[role="dialog"]').length,
    undefined as never,
  )).catch(() => null)) ?? 2;
  if (dialogCount > 1) {
    await Promise.allSettled([workedPage.keyboard.press('Escape'), workedPage.waitForTimeout(220)]);
  }
  await workedPage.waitForTimeout(200);
};

export const collectStrictRetry = async (
  page: LikersPage,
  maxCommentLikers: number,
  likesCount: number,
  likers: CommentLiker[],
) => {
  const capped = maxCommentLikers > 0 && likers.length >= maxCommentLikers;
  if (likesCount <= 0 || capped || likers.length >= likesCount) return likers;
  const missing = likesCount - likers.length;
  if (missing <= 1) return likers;
  await page.waitForTimeout(600);
  const retried = normalizeCommentLikers(await collectLikers(page, maxCommentLikers, likesCount, true));
  return retried.length > likers.length ? retried : likers;
};
