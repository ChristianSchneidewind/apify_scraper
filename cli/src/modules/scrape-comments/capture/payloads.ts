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
  plannedParts?: number | null,
  incompleteReason?: string | null,
) => {
  const links = buildCommentLinks(data.commentPermalink, sourceUrl);
  const incomplete = Boolean(incompleteReason) || (plannedParts != null && screenshotKeys.length < plannedParts);
  const needsReview = incomplete || screenshotKeys.length > 2;
  const flagReason = incomplete ? incompleteReason || 'incomplete_multipart' : 'more_than_2_parts';
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
    multipartFlagReason: needsReview ? flagReason : null,
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
