import type { CommentLiker, CommentRecord, LikersPage, OpenLikesResult, TimeLocator } from '../../../schemas/index.ts';
import { normalizeCommentLikers } from '../comment-state.ts';
import { refindCommentRowHandle } from '../extract-from-locator.ts';
import { collectLikersFromDialog, isDialogOpen, nudgeLikersDialogAtEnd, oscillateLikersDialogAtEnd, resetLikersDialogScroll, scrollLikersDialogToEnd, waitForDialogOpen } from './collect-dialog.ts';
import { clickLikesInCurrentPage, openLikesDeepLink } from './open-deep.ts';
import { openLikesInline } from './open-inline.ts';

const buildCommentUrl = (permalink: string | null) => {
  if (!permalink) return null;
  return permalink.startsWith('http') ? permalink : `https://www.instagram.com${permalink}`;
};

const preferPositiveCount = (nextCount: unknown, fallbackCount: unknown) => {
  const next = Number(nextCount ?? 0) || 0;
  const fallback = Number(fallbackCount ?? 0) || 0;
  return Math.max(next, fallback);
};

const withTimeout = async <T>(promise: Promise<T>, ms: number, label = 'likers step timeout') => {
  const timeout = new Promise<T>((_, reject) => setTimeout(() => reject(new Error(label)), ms));
  return Promise.race([promise, timeout]);
};

type CollectSession = {
  abort: AbortController;
};

const collectSessions = new WeakMap<object, CollectSession>();

const beginCollectSession = (page: LikersPage) => {
  const prev = collectSessions.get(page);
  prev?.abort.abort();
  const session = { abort: new AbortController() };
  collectSessions.set(page, session);
  return session;
};

const endCollectSession = (page: LikersPage, session: CollectSession) => {
  if (collectSessions.get(page) === session) collectSessions.delete(page);
};

const collectLikersTimed = async (
  page: LikersPage,
  maxCommentLikers: number,
  likesCount: number,
  verbose: boolean | undefined,
  timeoutMs: number,
  session: CollectSession,
) => {
  const timeoutAbort = new AbortController();
  const onSessionAbort = () => timeoutAbort.abort();
  session.abort.signal.addEventListener('abort', onSessionAbort);
  const timer = setTimeout(() => timeoutAbort.abort(), timeoutMs);
  const mergedSignal = timeoutAbort.signal;
  try {
    return await collectLikersFromDialog(
      page as never,
      maxCommentLikers,
      verbose,
      likesCount,
      mergedSignal,
    );
  } finally {
    clearTimeout(timer);
    session.abort.signal.removeEventListener('abort', onSessionAbort);
  }
};

const errorReason = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return `${fallback}:${error.message}`;
  return fallback;
};

const logLikersDebug = (verbose: boolean | undefined, message: string) => {
  if (!verbose) return;
  process.stderr.write(`[scrape.comments][likers] ${message}\n`);
};

const warnLikers = (message: string) => {
  process.stderr.write(`[scrape.comments][likers][warn] ${message}\n`);
};

const likersCache = new Map<string, CommentLiker[]>();

const likersCacheKey = (commentPermalink: string | null, likesCount: number) => {
  if (!commentPermalink || likesCount <= 0) return null;
  return `${commentPermalink}|${likesCount}`;
};

const readLikersCache = (commentPermalink: string | null, likesCount: number) => {
  const key = likersCacheKey(commentPermalink, likesCount);
  if (!key) return null;
  const cached = likersCache.get(key);
  return cached?.length ? cached : null;
};

const writeLikersCache = (
  commentPermalink: string | null,
  likesCount: number,
  likers: CommentLiker[],
  maxCommentLikers: number,
) => {
  const key = likersCacheKey(commentPermalink, likesCount);
  if (!key || !likers.length) return;
  const target = resolveLikerTarget(likesCount, maxCommentLikers);
  if (target > 0 && likers.length < target - 1) return;
  likersCache.set(key, likers);
};

const resolveLikerTarget = (likesCount: number, maxCommentLikers: number) => {
  if (maxCommentLikers > 0) return Math.min(likesCount || maxCommentLikers, maxCommentLikers);
  return likesCount || 0;
};

const hasEnoughLikers = (likers: CommentLiker[], likesCount: number, maxCommentLikers: number) => {
  if (!Array.isArray(likers)) return false;
  const target = resolveLikerTarget(likesCount, maxCommentLikers);
  if (target > 0) return likers.length >= target;
  return likers.length > 0;
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
): Array<[number, number]> => {
  const missing = likerGap(likesCount, maxCommentLikers, collected);
  const retryTimeoutMs = Math.max(initialTimeoutMs, 8000);
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

const openContextPage = async (page: LikersPage) => {
  const ctx = typeof (page as { context?: unknown }).context === 'function'
    ? (page as unknown as { context: () => { newPage: () => Promise<LikersPage> } }).context()
    : (page as { context?: { newPage: () => Promise<LikersPage> } }).context;
  if (!ctx?.newPage) throw new Error('context.newPage unavailable');
  return ctx.newPage();
};

const tryDeepFallback = async (
  page: LikersPage,
  commentUrl: string,
  commentPermalink: string,
  likesCount: number,
  verbose?: boolean,
) => {
  const nextPage = await Promise.allSettled([openContextPage(page)]);
  if (nextPage[0]?.status !== 'fulfilled') return { likesCount, page, reason: 'deep_new_page_failed', worked: false };
  const p2 = nextPage[0].value;
  const deep = await Promise.allSettled([openLikesDeepLink(p2 as never, commentUrl, commentPermalink, verbose)]);
  if (deep[0]?.status !== 'fulfilled') return { likesCount, page, reason: 'deep_open_failed', worked: false };
  const result = deep[0].value;
  const deepLikes = Number(result.likesCount ?? likesCount);
  if (!result.clicked) return { likesCount: deepLikes, page, reason: result.reason, worked: false };
  await p2.waitForTimeout(1200);
  return { likesCount: deepLikes, page: p2, reason: result.reason, worked: true };
};

const closeDialog = async (workedPage: LikersPage, likesCount: number, likers: CommentLiker[]) => {
  if (likesCount > 0 && likers.length === 0) await workedPage.waitForTimeout(1000);
  for (let i = 0; i < 4; i += 1) {
    if (i > 0) {
      const open = await Promise.resolve(isDialogOpen(workedPage as never)).catch(() => false);
      if (!open) break;
    }
    await Promise.allSettled([
      workedPage.keyboard.press('Escape'),
      workedPage.waitForTimeout(220),
    ]);
  }
  await workedPage.waitForTimeout(200);
};

const retryDialogScroll = async (page: LikersPage) => {
  await Promise.allSettled([
    page.evaluate(() => {
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
      const dialog = dialogs[dialogs.length - 1];
      if (!dialog) return;
      const candidates = Array.from(dialog.querySelectorAll('div, ul')) as Array<Element & { scrollHeight: number; clientHeight: number; scrollTop: number }>;
      for (const candidate of candidates) {
        if (candidate.scrollHeight > candidate.clientHeight + 20) {
          candidate.scrollTop += Math.max(300, candidate.clientHeight * 0.9);
          break;
        }
      }
    }, undefined as never),
    scrollLikersDialogToEnd(page as never),
    oscillateLikersDialogAtEnd(page as never),
    nudgeLikersDialogAtEnd(page as never),
  ]);
};

const collectLikersAttempt = async (
  page: LikersPage,
  maxCommentLikers: number,
  likesCount: number,
  waitMs: number,
  timeoutMs: number,
  session: CollectSession,
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
    if (verbose) {
      process.stderr.write(`[scrape.comments][likers][debug] attempt wait=${waitMs} timeout=${timeoutMs} result=${result.length}\n`);
    }
    return result;
  }
  const merged = normalizeCommentLikers([...seedLikers, ...result]);
  const out = merged.length > result.length ? merged : result;
  if (verbose) {
    process.stderr.write(`[scrape.comments][likers][debug] attempt wait=${waitMs} timeout=${timeoutMs} result=${out.length}\n`);
  }
  return out;
};

const collectLikers = async (page: LikersPage, maxCommentLikers: number, likesCount: number, verbose?: boolean) => {
  const session = beginCollectSession(page);
  try {
    const initialTimeoutMs = likerCollectTimeoutMs(likesCount, maxCommentLikers);
    let likers = normalizeCommentLikers(
      await collectLikersTimed(page, maxCommentLikers, likesCount, verbose, initialTimeoutMs, session),
    );
    if (verbose) {
      process.stderr.write(`[scrape.comments][likers][debug] initial result=${likers.length} likesCount=${likesCount} max=${maxCommentLikers} timeout=${initialTimeoutMs}\n`);
    }
    if (hasEnoughLikers(likers, likesCount, maxCommentLikers) || likesCount <= 0) return likers;

    const attempts = resolveRetryAttempts(likesCount, maxCommentLikers, likers.length, initialTimeoutMs);
    let noProgressStreak = 0;

    for (const [waitMs, timeoutMs] of attempts) {
      if (session.abort.signal.aborted) break;
      const prevLen = likers.length;
      const next = await collectLikersAttempt(page, maxCommentLikers, likesCount, waitMs, timeoutMs, session, verbose, likers);
      if (next.length > prevLen) {
        likers = next;
        noProgressStreak = 0;
      } else {
        noProgressStreak += 1;
        const missing = likerGap(likesCount, maxCommentLikers, likers.length);
        if (likers.length > 0 && missing <= 1 && noProgressStreak >= 2) {
          if (verbose) {
            process.stderr.write(`[scrape.comments][likers][debug] stop=no_progress gap=${missing} streak=${noProgressStreak}\n`);
          }
          break;
        }
        if (likers.length > 0 && missing <= 3 && noProgressStreak >= 2) {
          if (verbose) {
            process.stderr.write(`[scrape.comments][likers][debug] stop=no_progress gap=${missing} streak=${noProgressStreak}\n`);
          }
          break;
        }
      }
      if (verbose) {
        process.stderr.write(`[scrape.comments][likers][debug] after attempt result=${likers.length} wait=${waitMs} timeout=${timeoutMs}\n`);
      }
      if (hasEnoughLikers(likers, likesCount, maxCommentLikers)) break;
    }
    return likers;
  } finally {
    endCollectSession(page, session);
  }
};

const collectStrictRetry = async (
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

export const enrichCommentLikers = async (
  page: LikersPage,
  handle: TimeLocator,
  data: CommentRecord,
  maxCommentLikers = 0,
  likerCollectionMode: 'best_effort' | 'strict' = 'best_effort',
  verbose?: boolean,
) => {
  const commentPermalink = data.commentPermalink;
  const commentUrl = buildCommentUrl(commentPermalink);
  data.commentLikers = [];

  const extractedLikes = Number(data.likesCount ?? 0) || 0;
  const cachedLikers = readLikersCache(commentPermalink, extractedLikes);
  if (cachedLikers && hasEnoughLikers(cachedLikers, extractedLikes, maxCommentLikers)) {
    data.commentLikers = cachedLikers;
    data.likesCount = preferPositiveCount(extractedLikes, cachedLikers.length);
    logLikersDebug(verbose, `user=${data.username} cacheHit=${cachedLikers.length} finalLikes=${data.likesCount}`);
    return data;
  }

  const inline = await withTimeout(openLikesInline(handle, commentPermalink), 2500, 'inline_timeout')
    .catch((error) => ({ clicked: false, likesCount: extractedLikes, reason: errorReason(error, 'inline_error') } as OpenLikesResult));
  const inlineLikes = preferPositiveCount(inline.likesCount, extractedLikes);
  data.likesCount = inlineLikes;

  let workedPage: LikersPage = page;
  let clicked = Boolean(inline.clicked);
  let currentReason = inline.reason;
  logLikersDebug(verbose, `user=${data.username} extracted=${extractedLikes} inline.clicked=${clicked} inline.reason=${inline.reason ?? 'n/a'} inline.likes=${Number(inline.likesCount ?? 0) || 0}`);

  if (!clicked) {
    const refound = await refindCommentRowHandle(page as never, data).catch(() => null);
    if (refound) {
      const retryInline = await withTimeout(openLikesInline(refound, commentPermalink), 2500, 'inline_refind_timeout')
        .catch((error) => ({ clicked: false, likesCount: data.likesCount ?? inlineLikes, reason: errorReason(error, 'inline_refind_error') } as OpenLikesResult));
      data.likesCount = preferPositiveCount(retryInline.likesCount, data.likesCount);
      clicked = Boolean(retryInline.clicked);
      currentReason = retryInline.reason;
      logLikersDebug(verbose, `user=${data.username} refind.clicked=${clicked} refind.reason=${retryInline.reason ?? 'n/a'} refind.likes=${Number(retryInline.likesCount ?? 0) || 0}`);
    }
  }

  if (!clicked && commentPermalink) {
    const current = await withTimeout(clickLikesInCurrentPage(page as never, commentPermalink, verbose), 5000, 'current_timeout')
      .catch((error) => ({ clicked: false, likesCount: inlineLikes, reason: errorReason(error, 'current_error') }));
    data.likesCount = preferPositiveCount(current.likesCount, data.likesCount);
    clicked = Boolean(current.clicked);
    currentReason = current.reason;
    logLikersDebug(verbose, `user=${data.username} current.clicked=${clicked} current.reason=${current.reason ?? 'n/a'} current.likes=${Number(current.likesCount ?? 0) || 0}`);
  }

  const shouldTryDeepFallback = !clicked && Boolean(commentUrl && commentPermalink) && Number(data.likesCount ?? 0) > 0;
  if (!clicked && !shouldTryDeepFallback && commentUrl && commentPermalink) {
    currentReason = 'deep_skip_zero_likes';
  }
  if (shouldTryDeepFallback && commentUrl && commentPermalink) {
    const deep = await withTimeout(tryDeepFallback(page, commentUrl, commentPermalink, data.likesCount ?? inlineLikes, verbose), 9000, 'deep_timeout')
      .catch((error) => ({ likesCount: data.likesCount ?? inlineLikes, page, reason: errorReason(error, 'deep_error'), worked: false }));
    data.likesCount = preferPositiveCount(deep.likesCount, data.likesCount);
    workedPage = deep.page;
    clicked = deep.worked;
    currentReason = deep.reason;
    logLikersDebug(verbose, `user=${data.username} deep.clicked=${clicked} deep.reason=${deep.reason ?? 'n/a'} deep.likes=${Number(deep.likesCount ?? 0) || 0}`);
  }

  if (!clicked) {
    logLikersDebug(verbose, `user=${data.username} stop=no_click finalLikes=${data.likesCount} reason=${currentReason ?? 'n/a'}`);
    return data;
  }

  const dialogOpened = await withTimeout(waitForDialogOpen(workedPage as never), 4000, 'dialog_open_timeout').catch(() => false);
  logLikersDebug(verbose, `user=${data.username} dialogOpened=${dialogOpened}`);
  if (!dialogOpened) return data;

  await workedPage.waitForTimeout(300);
  let likers = normalizeCommentLikers(await collectLikers(workedPage, maxCommentLikers, data.likesCount ?? 0, verbose));
  if (likerCollectionMode === 'strict') {
    likers = await collectStrictRetry(workedPage, maxCommentLikers, data.likesCount ?? 0, likers);
  }
  data.commentLikers = likers;
  data.likesCount = preferPositiveCount(data.likesCount, likers.length);
  writeLikersCache(commentPermalink, data.likesCount ?? 0, likers, maxCommentLikers);
  logLikersDebug(verbose, `user=${data.username} collected=${likers.length} finalLikes=${data.likesCount}`);
  if (likerCollectionMode === 'strict' && data.likesCount > 0) {
    const capped = maxCommentLikers > 0 && likers.length >= maxCommentLikers;
    if (!capped && likers.length < data.likesCount) {
      warnLikers(`strict incomplete user=${data.username} collected=${likers.length} likesCount=${data.likesCount}`);
    }
  }
  await closeDialog(workedPage, data.likesCount, likers);
  return data;
};

export const clearLikersCacheForTests = () => {
  likersCache.clear();
};
