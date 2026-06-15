import type { CommentRecord } from '../../schemas/index.ts';
import { buildCommentLinks } from './comment-links.ts';

export const buildCommentOutputRecord = (
  comment: CommentRecord,
  sourceUrl: string,
  index: number,
  screenshotKeys: string[],
  screenshotPaths: string[],
  metadataPath: string | null,
) => {
  const links = buildCommentLinks(comment.commentPermalink, sourceUrl);
  const partsTotal = screenshotKeys.length;
  const needsReview = partsTotal > 2;
  return {
    ...comment,
    commentDeepLink: links.commentDeepLink,
    commentUrl: links.commentUrl,
    index,
    metadataPath,
    multipartFlagReason: needsReview ? 'more_than_2_parts' : null,
    multipartNeedsReview: needsReview,
    partsTotal,
    screenshotKey: screenshotKeys[0] || null,
    screenshotKeys,
    screenshotPath: screenshotPaths[0] || null,
    screenshotPaths,
    sourceUrl,
  };
};
