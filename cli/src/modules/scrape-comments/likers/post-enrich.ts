import { readFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import type { CommentRecord, LikersPage, ScrapeCommentsOptions } from '../../../schemas/index.ts';
import { writeJsonFile } from '../../../adapters/filesystem/output.ts';
import { normalizeCommentLikers } from '../comment-state.ts';
import { waitForDialogOpen } from './collect-dialog.ts';
import { closeDialog, collectLikers } from './enrich-collect.ts';
import { openLikesDeepLink } from './open-deep.ts';

const commentUrl = (comment: CommentRecord) => {
  const path = comment.parentCommentPermalink || comment.commentPermalink;
  return path ? `https://www.instagram.com${path}` : null;
};

const setIncomplete = (comment: CommentRecord, reason: string) => {
  comment.commentLikers = [];
  comment.likersComplete = (comment.likesCount || 0) === 0;
  comment.likersReason = comment.likersComplete ? null : reason;
};

const retryConfig = (options: ScrapeCommentsOptions) => ({
  retryAttempts: options.likerRetryAttempts ?? (options.likerCollectionMode === 'strict' ? 3 : 0),
  ...(options.likerRetryDelayMs !== undefined ? { retryDelayMs: options.likerRetryDelayMs } : {}),
  ...(options.likerTimeoutMs !== undefined ? { timeoutMs: options.likerTimeoutMs } : {}),
});

const enrichOne = async (
  page: LikersPage,
  comment: CommentRecord,
  options: ScrapeCommentsOptions,
) => {
  const url = commentUrl(comment);
  if (comment.parentCommentPermalink) {
    setIncomplete(comment, 'reel_reply_likers_unavailable');
    return;
  }
  if (!url || !comment.commentPermalink || (comment.likesCount || 0) <= 0) {
    setIncomplete(comment, 'no_likes_or_permalink');
    return;
  }
  const opened = await openLikesDeepLink(page as never, url, comment.commentPermalink, options.verbose)
    .catch(() => ({ clicked: false, reason: 'deep_open_failed' }));
  if (!opened.clicked || !(await waitForDialogOpen(page as never))) {
    setIncomplete(comment, opened.reason || 'dialog_open_failed');
    return;
  }
  const likers = normalizeCommentLikers(await collectLikers(
    page,
    options.maxCommentLikers ?? 0,
    comment.likesCount || 0,
    options.verbose,
    retryConfig(options),
  ));
  comment.commentLikers = likers;
  comment.likersComplete = likers.length >= (comment.likesCount || 0);
  comment.likersReason = comment.likersComplete ? null : 'partial_visible_results';
  await closeDialog(page, comment.likesCount || 0, likers);
};

const updateMetadata = async (comment: CommentRecord) => {
  if (!comment.metadataPath) return;
  const current = JSON.parse(await readFile(comment.metadataPath, 'utf8')) as Record<string, unknown>;
  await writeJsonFile(dirname(comment.metadataPath), basename(comment.metadataPath), {
    ...current,
    commentLikers: comment.commentLikers || [],
    likesCount: comment.likesCount || 0,
    likersComplete: comment.likersComplete ?? false,
    likersReason: comment.likersReason ?? null,
    parentCommentPermalink: comment.parentCommentPermalink ?? null,
  });
};

const enrichComments = async (
  page: LikersPage,
  comments: CommentRecord[],
  options: ScrapeCommentsOptions,
  outDir: string,
) => {
  for (const comment of comments) {
    await enrichOne(page, comment, options);
    await updateMetadata(comment).catch(() => undefined);
    await writeJsonFile(outDir, 'checkpoint.json', { comments, sourceUrl: options.url });
  }
};

export const enrichReelCommentsAfterCapture = async (
  browserContext: { newPage: () => Promise<LikersPage & { close: () => Promise<void> }> },
  comments: CommentRecord[],
  options: ScrapeCommentsOptions,
  outDir: string,
) => {
  const page = await browserContext.newPage();
  try {
    await enrichComments(page, comments, options, outDir);
  } finally {
    await page.close();
  }
  return comments;
};
