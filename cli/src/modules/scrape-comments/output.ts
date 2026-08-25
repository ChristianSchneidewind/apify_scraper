import type { CommentRecord } from '../../schemas/index.ts';
import { buildCommentLinks } from './comment-links.ts';

export const buildCommentOutputRecord = (
  comment: CommentRecord,
  sourceUrl: string,
  index: number,
  screenshotKeys: string[],
  screenshotPaths: string[],
  metadataPath: string | null,
  plannedParts?: number | null,
  incompleteReason?: string | null,
) => {
  const links = buildCommentLinks(comment.commentPermalink, sourceUrl);
  const partsTotal = screenshotKeys.length;
  const incomplete = Boolean(incompleteReason) || (plannedParts != null && partsTotal < plannedParts);
  const needsReview = incomplete || partsTotal > 2;
  const flagReason = incomplete ? incompleteReason || 'incomplete_multipart' : 'more_than_2_parts';
  return {
    ...comment,
    commentDeepLink: links.commentDeepLink,
    commentUrl: links.commentUrl,
    index,
    metadataPath,
    multipartFlagReason: needsReview ? flagReason : null,
    multipartNeedsReview: needsReview,
    partsTotal,
    screenshotKey: screenshotKeys[0] || null,
    screenshotKeys,
    screenshotPath: screenshotPaths[0] || null,
    screenshotPaths,
    sourceUrl,
  };
};
