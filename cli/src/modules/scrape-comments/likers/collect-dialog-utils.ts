import type { CommentLiker, LikersBatch } from '../../../schemas/index.ts';

export const mergeBatch = (
  batch: LikersBatch,
  seen: Set<string>,
  likers: CommentLiker[],
  maxCommentLikers: number,
) => {
  let added = 0;
  for (const item of batch.items || []) {
    const u = (item.username || '').trim();
    const p = (item.profilePath || '').trim();
    if (!u || !p) continue;
    const key = u.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const profileUrl = p.startsWith('http') ? p : `https://www.instagram.com${p}`;
    likers.push({ profileUrl, username: u });
    added += 1;
    if (maxCommentLikers && likers.length >= maxCommentLikers) break;
  }
  return added;
};

export const resolveTargetCount = (maxCommentLikers: number, likesCount: number) => {
  if (maxCommentLikers > 0) return Math.min(maxCommentLikers, likesCount || maxCommentLikers);
  return likesCount || 0;
};

export const resolveMaxRounds = (maxCommentLikers: number, likesCount: number) => {
  const target = resolveTargetCount(maxCommentLikers, likesCount);
  if (target >= 50) return Math.min(300, Math.max(80, Math.ceil(target / 2)));
  if (maxCommentLikers === 0) return 240;
  return 60;
};

export const likerGap = (targetCount: number, collected: number) => {
  if (targetCount <= 0) return 0;
  return Math.max(0, targetCount - collected);
};

export const resolveMaxRewinds = (targetCount: number, collected: number) => {
  const gap = likerGap(targetCount, collected);
  if (gap <= 0) return 0;
  if (gap <= 5) return 2;
  return 1;
};

export const isNearTarget = (targetCount: number, collected: number) =>
  targetCount > 0 && collected >= targetCount - 2 && collected < targetCount;

export const isLikelyUnrecoverableGap = (targetCount: number, collected: number, failedRewinds: number) => {
  const gap = likerGap(targetCount, collected);
  if (gap <= 0) return true;
  if (gap <= 2) return failedRewinds >= 2;
  return false;
};
