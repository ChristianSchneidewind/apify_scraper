import type { CommentRecord } from '../../schemas/index.ts';

export const buildCommentKey = (comment: CommentRecord) =>
  [
    comment.username.toLowerCase(),
    comment.text.trim().toLowerCase(),
    comment.commentPermalink || '',
    comment.timeText || '',
  ].join('|');
