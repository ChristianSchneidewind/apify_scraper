import type { CommentLiker } from '../../../schemas/index.ts';

const likersCache = new Map<string, CommentLiker[]>();

export const resolveLikerTarget = (likesCount: number, maxCommentLikers: number) => {
  if (maxCommentLikers > 0) return Math.min(likesCount || maxCommentLikers, maxCommentLikers);
  return likesCount || 0;
};

export const hasEnoughLikers = (likers: CommentLiker[], likesCount: number, maxCommentLikers: number) => {
  if (!Array.isArray(likers)) return false;
  const target = resolveLikerTarget(likesCount, maxCommentLikers);
  if (target > 0) return likers.length >= target;
  return likers.length > 0;
};

const likersCacheKey = (commentPermalink: string | null, likesCount: number) => {
  if (!commentPermalink || likesCount <= 0) return null;
  return `${commentPermalink}|${likesCount}`;
};

export const readLikersCache = (commentPermalink: string | null, likesCount: number) => {
  const key = likersCacheKey(commentPermalink, likesCount);
  if (!key) return null;
  const cached = likersCache.get(key);
  return cached?.length ? cached : null;
};

export const writeLikersCache = (
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

export const clearLikersCacheForTests = () => {
  likersCache.clear();
};
