import type { CommentLiker, CommentRecord, LikersPage, OpenLikesResult, TimeLocator } from '../../../schemas/index.ts';
import { normalizeCommentLikers } from '../comment-state.ts';
import { refindCommentRowHandle } from '../extract-from-locator.ts';
import { waitForDialogOpen } from './collect-dialog.ts';
import { clickLikesInCurrentPage } from './open-deep.ts';
import { tryDeepFallback } from './deep-fallback.ts';
import { openLikesInline } from './open-inline.ts';
import { hasEnoughLikers, readLikersCache, writeLikersCache } from './enrich-cache.ts';
import { closeDialog, collectLikers, collectStrictRetry } from './enrich-collect.ts';

const buildCommentUrl = (permalink: string | null) => {
  if (!permalink) return null;
  return permalink.startsWith('http') ? permalink : `https://www.instagram.com${permalink}`;
};

const preferPositiveCount = (nextCount: unknown, fallbackCount: unknown) => {
  const next = Number(nextCount ?? 0) || 0;
  const fallback = Number(fallbackCount ?? 0) || 0;
  return Math.max(next, fallback);
};

const setLikerStatus = (data: CommentRecord, likers: CommentLiker[], reason: string | null) => {
  const likes = Number(data.likesCount ?? 0) || 0;
  data.likersComplete = likes === 0 || likers.length >= likes;
  data.likersReason = data.likersComplete ? null : reason;
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

const applyCachedLikers = (
  data: CommentRecord,
  commentPermalink: string | null,
  extractedLikes: number,
  maxCommentLikers: number,
  verbose?: boolean,
) => {
  const cachedLikers = readLikersCache(commentPermalink, extractedLikes);
  if (!cachedLikers || !hasEnoughLikers(cachedLikers, extractedLikes, maxCommentLikers)) return false;
  data.commentLikers = cachedLikers;
  data.likesCount = preferPositiveCount(extractedLikes, cachedLikers.length);
  setLikerStatus(data, cachedLikers, null);
  logLikersDebug(verbose, `user=${data.username} cacheHit=${cachedLikers.length} finalLikes=${data.likesCount}`);
  return true;
};

const openInlineInitial = async (
  handle: TimeLocator,
  commentPermalink: string | null,
  extractedLikes: number,
) => withTimeout(openLikesInline(handle, commentPermalink), 2500, 'inline_timeout')
  .catch((error) => ({ clicked: false, likesCount: extractedLikes, reason: errorReason(error, 'inline_error') } as OpenLikesResult));

const openInlineWithRefind = async (
  page: LikersPage,
  handle: TimeLocator,
  data: CommentRecord,
  commentPermalink: string | null,
  extractedLikes: number,
  verbose?: boolean,
) => {
  const inline = await openInlineInitial(handle, commentPermalink, extractedLikes);
  const inlineLikes = preferPositiveCount(inline.likesCount, extractedLikes);
  data.likesCount = inlineLikes;
  let clicked = Boolean(inline.clicked);
  let currentReason = inline.reason;
  logLikersDebug(verbose, `user=${data.username} extracted=${extractedLikes} inline.clicked=${clicked} inline.reason=${inline.reason ?? 'n/a'} inline.likes=${Number(inline.likesCount ?? 0) || 0}`);
  if (clicked) return { clicked, currentReason, inlineLikes };
  const refound = await refindCommentRowHandle(page as never, data).catch(() => null);
  if (!refound) return { clicked, currentReason, inlineLikes };
  const retryInline = await withTimeout(openLikesInline(refound, commentPermalink), 2500, 'inline_refind_timeout')
    .catch((error) => ({ clicked: false, likesCount: data.likesCount ?? inlineLikes, reason: errorReason(error, 'inline_refind_error') } as OpenLikesResult));
  data.likesCount = preferPositiveCount(retryInline.likesCount, data.likesCount);
  clicked = Boolean(retryInline.clicked);
  currentReason = retryInline.reason;
  logLikersDebug(verbose, `user=${data.username} refind.clicked=${clicked} refind.reason=${retryInline.reason ?? 'n/a'} refind.likes=${Number(retryInline.likesCount ?? 0) || 0}`);
  return { clicked, currentReason, inlineLikes };
};

const openCurrentIfNeeded = async (
  page: LikersPage,
  data: CommentRecord,
  commentPermalink: string | null,
  clicked: boolean,
  currentReason: string | undefined,
  inlineLikes: number,
  verbose?: boolean,
) => {
  if (clicked || !commentPermalink) return { clicked, currentReason };
  const current = await withTimeout(clickLikesInCurrentPage(page as never, commentPermalink, verbose), 5000, 'current_timeout')
    .catch((error) => ({ clicked: false, likesCount: inlineLikes, reason: errorReason(error, 'current_error') }));
  data.likesCount = preferPositiveCount(current.likesCount, data.likesCount);
  logLikersDebug(verbose, `user=${data.username} current.clicked=${Boolean(current.clicked)} current.reason=${current.reason ?? 'n/a'} current.likes=${Number(current.likesCount ?? 0) || 0}`);
  return { clicked: Boolean(current.clicked), currentReason: current.reason };
};

const openDeepIfNeeded = async (
  page: LikersPage,
  data: CommentRecord,
  commentUrl: string | null,
  commentPermalink: string | null,
  clicked: boolean,
  currentReason: string | undefined,
  inlineLikes: number,
  verbose?: boolean,
) => {
  const shouldTry = !clicked && Boolean(commentUrl && commentPermalink) && Number(data.likesCount ?? 0) > 0;
  if (!clicked && !shouldTry && commentUrl && commentPermalink) return { clicked, currentReason: 'deep_skip_zero_likes', workedPage: page };
  if (!shouldTry || !commentUrl || !commentPermalink) return { clicked, currentReason, workedPage: page };
  const deep = await withTimeout(tryDeepFallback(page, commentUrl, commentPermalink, data.likesCount ?? inlineLikes, verbose), 9000, 'deep_timeout')
    .catch((error) => ({ likesCount: data.likesCount ?? inlineLikes, page, reason: errorReason(error, 'deep_error'), worked: false }));
  data.likesCount = preferPositiveCount(deep.likesCount, data.likesCount);
  logLikersDebug(verbose, `user=${data.username} deep.clicked=${deep.worked} deep.reason=${deep.reason ?? 'n/a'} deep.likes=${Number(deep.likesCount ?? 0) || 0}`);
  return { clicked: deep.worked, currentReason: deep.reason, workedPage: deep.page };
};

const warnStrictIncomplete = (
  data: CommentRecord,
  likers: CommentLiker[],
  maxCommentLikers: number,
  mode: 'best_effort' | 'strict',
) => {
  if (mode !== 'strict' || !data.likesCount || data.likesCount <= 0) return;
  const capped = maxCommentLikers > 0 && likers.length >= maxCommentLikers;
  if (!capped && likers.length < data.likesCount) warnLikers(`strict incomplete user=${data.username} collected=${likers.length} likesCount=${data.likesCount}`);
};

const countVisibleLikerLinks = () => {
  const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
  const dialog = dialogs.find((d) => /gefällt|likes?|personen|people/i.test(d.textContent || '')) || dialogs[dialogs.length - 1];
  if (!dialog) return 0;
  return Array.from(dialog.querySelectorAll('a[href]')).filter((a) => {
    const href = a.getAttribute('href') || '';
    return /^\/[A-Za-z0-9._]+\/?($|\?)/.test(href) && !href.startsWith('/p/') && !href.startsWith('/reel/');
  }).length;
};

const pressReelSafePageDown = async (page: LikersPage, isReel: boolean, enabled: boolean) => {
  if (!isReel && enabled && page.keyboard?.press) await page.keyboard.press('PageDown').catch(() => undefined);
};


const waitForDialogLikersReady = async (page: LikersPage, verbose?: boolean) => {
  const currentUrl = typeof page.url === 'function' ? page.url() : '';
  const isReel = /\/reels?\//.test(currentUrl);
  for (let i = 0; i < 40; i += 1) {
    const count = await Promise.resolve(page.evaluate(countVisibleLikerLinks, undefined as never)).catch(() => null);
    if (count === null || count === undefined || count > 0) return true;
    await pressReelSafePageDown(page, isReel, i === 10 || i === 20);
    await page.waitForTimeout(500);
  }
  logLikersDebug(verbose, 'dialogReady=false reason=no_visible_liker_links_after_20s');
  return false;
};

const collectFromOpenDialog = async (
  workedPage: LikersPage,
  data: CommentRecord,
  commentPermalink: string | null,
  maxCommentLikers: number,
  mode: 'best_effort' | 'strict',
  verbose?: boolean,
  retryConfig?: { retryAttempts?: number; retryDelayMs?: number; timeoutMs?: number },
) => {
  const dialogOpened = await withTimeout(waitForDialogOpen(workedPage as never), 4000, 'dialog_open_timeout').catch(() => false);
  logLikersDebug(verbose, `user=${data.username} dialogOpened=${dialogOpened}`);
  if (!dialogOpened) {
    setLikerStatus(data, [], 'dialog_open_failed');
    return data;
  }
  await workedPage.waitForTimeout(300);
  const ready = await waitForDialogLikersReady(workedPage, verbose);
  if (!ready) setLikerStatus(data, [], 'no_visible_liker_links');
  let likers = ready ? normalizeCommentLikers(await collectLikers(workedPage, maxCommentLikers, data.likesCount ?? 0, verbose, retryConfig)) : [];
  if (mode === 'strict') likers = await collectStrictRetry(workedPage, maxCommentLikers, data.likesCount ?? 0, likers);
  data.commentLikers = likers;
  data.likesCount = preferPositiveCount(data.likesCount, likers.length);
  setLikerStatus(data, likers, ready ? 'partial_visible_results' : 'no_visible_liker_links');
  writeLikersCache(commentPermalink, data.likesCount ?? 0, likers, maxCommentLikers);
  logLikersDebug(verbose, `user=${data.username} collected=${likers.length} finalLikes=${data.likesCount}`);
  warnStrictIncomplete(data, likers, maxCommentLikers, mode);
  await closeDialog(workedPage, data.likesCount, likers);
  return data;
};

export const enrichCommentLikers = async (
  page: LikersPage,
  handle: TimeLocator,
  data: CommentRecord,
  maxCommentLikers = 0,
  likerCollectionMode: 'best_effort' | 'strict' = 'best_effort',
  verbose?: boolean,
  retryConfig?: { retryAttempts?: number; retryDelayMs?: number; timeoutMs?: number },
) => {
  const commentPermalink = data.commentPermalink;
  const commentUrl = buildCommentUrl(data.parentCommentPermalink || commentPermalink);
  const extractedLikes = Number(data.likesCount ?? 0) || 0;
  data.commentLikers = [];
  if (applyCachedLikers(data, commentPermalink, extractedLikes, maxCommentLikers, verbose)) return data;

  const currentUrl = typeof page.url === 'function' ? page.url() : '';
  const isReel = /\/reels?\//.test(currentUrl);
  if (isReel && data.parentCommentPermalink) {
    setLikerStatus(data, [], 'reel_reply_likers_unavailable');
    return data;
  }
  const inline = isReel
    ? { clicked: false, currentReason: 'reel_deep_isolation', inlineLikes: extractedLikes }
    : await openInlineWithRefind(page, handle, data, commentPermalink, extractedLikes, verbose);
  const current = isReel
    ? { clicked: false, currentReason: inline.currentReason }
    : await openCurrentIfNeeded(page, data, commentPermalink, inline.clicked, inline.currentReason, inline.inlineLikes, verbose);
  const deep = await openDeepIfNeeded(page, data, commentUrl, commentPermalink, current.clicked, current.currentReason, inline.inlineLikes, verbose);
  if (!deep.clicked) {
    setLikerStatus(data, [], deep.currentReason ?? 'likes_dialog_not_opened');
    logLikersDebug(verbose, `user=${data.username} stop=no_click finalLikes=${data.likesCount} reason=${deep.currentReason ?? 'n/a'}`);
    return data;
  }
  const result = await collectFromOpenDialog(deep.workedPage, data, commentPermalink, maxCommentLikers, likerCollectionMode, verbose, retryConfig);
  if (deep.workedPage !== page) {
    await (deep.workedPage as LikersPage & { close?: () => Promise<void> }).close?.().catch(() => undefined);
  }
  return result;
};

export { clearLikersCacheForTests } from './enrich-cache.ts';
