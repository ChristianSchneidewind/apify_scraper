import type { CommentRecord } from '../../../schemas/index.ts';
import { buildCommentLinks } from '../comment-links.ts';

export const buildCommentMetadataPayload = (
  data: CommentRecord,
  index: number,
  sourceUrl: string,
  screenshotUuid: string,
  screenshotUtc: string,
  screenshotKeys: string[],
  visibleInViewport?: boolean,
) => {
  const links = buildCommentLinks(data.commentPermalink, sourceUrl);
  const needsReview = screenshotKeys.length > 2;
  return {
    capturedAtUtc: screenshotUtc,
    commentDeepLink: links.commentDeepLink,
    commentLikers: data.commentLikers || [],
    commentPermalink: data.commentPermalink,
    commentUrl: links.commentUrl,
    datetime: data.datetime,
    id: screenshotUuid,
    index,
    isGifOnly: Boolean(data.isGifOnly),
    likesCount: Number(data.likesCount || 0),
    multipartFlagReason: needsReview ? 'more_than_2_parts' : null,
    multipartNeedsReview: needsReview,
    partsTotal: screenshotKeys.length,
    screenshotKeys,
    sourceUrl,
    text: data.text,
    timeText: data.timeText,
    username: data.username,
    ...(visibleInViewport !== undefined ? { visibleInViewport } : {}),
  };
};
