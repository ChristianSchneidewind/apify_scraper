import type { CommentLiker, CommentRecord, LikersPage, OpenLikesResult, TimeLocator } from '../../../schemas/index.ts';
import { normalizeCommentLikers } from '../comment-state.ts';
import { refindCommentRowHandle } from '../extract-from-locator.ts';
import { collectLikersFromDialog, waitForDialogOpen } from './collect-dialog.ts';
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
  await Promise.allSettled([workedPage.keyboard.press('Escape'), workedPage.waitForTimeout(150)]);
};

const collectLikers = async (page: LikersPage, maxCommentLikers: number, likesCount: number) => {
  let likers = await withTimeout(collectLikersFromDialog(page as never, maxCommentLikers), 3000).catch(() => []);
  if (!likers.length && likesCount > 0) {
    await page.waitForTimeout(500);
    likers = await withTimeout(collectLikersFromDialog(page as never, maxCommentLikers), 2000).catch(() => []);
  }
  return likers;
};

const collectStrictRetry = async (
  page: LikersPage,
  maxCommentLikers: number,
  likesCount: number,
  likers: CommentLiker[],
) => {
  const capped = maxCommentLikers > 0 && likers.length >= maxCommentLikers;
  if (likesCount <= 0 || capped || likers.length >= likesCount) return likers;
  await page.waitForTimeout(600);
  const retried = normalizeCommentLikers(await collectLikers(page, maxCommentLikers, likesCount));
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
  let likers = normalizeCommentLikers(await collectLikers(workedPage, maxCommentLikers, data.likesCount ?? 0));
  if (likerCollectionMode === 'strict') {
    likers = await collectStrictRetry(workedPage, maxCommentLikers, data.likesCount ?? 0, likers);
  }
  data.commentLikers = likers;
  data.likesCount = preferPositiveCount(data.likesCount, likers.length);
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
