import type { CommentIdentityInput, RawCommentLiker, SeenCommentState } from '../../schemas/index.ts';

export const buildCommentIdentity = (data: CommentIdentityInput) => {
  const username = (data.username || '').trim().toLowerCase();
  const text = (data.text || '').trim().toLowerCase();
  const dt = (data.datetime || '').trim().toLowerCase();
  const tt = (data.timeText || '').trim().toLowerCase();
  const isGif = Boolean(data.isGifOnly);
  const permalink = (data.commentPermalink || '').trim();
  const strictKey = `${username}|${text}|${dt}`;
  const looseKey = isGif
    ? `gif|${username}|${tt || dt}`
    : `txt|${username}|${text}|${tt || dt}`;
  return { looseKey, permalink, strictKey };
};

export const registerCommentSeen = (
  state: SeenCommentState,
  strictKey: string,
  looseKey: string,
  permalink: string | null,
  commentUid: string | null,
) => {
  state.seenStrict.add(strictKey);
  state.seenLoose.add(looseKey);
  if (permalink) state.seenPermalink.add(permalink);
  if (commentUid) state.seenUid.add(commentUid);
};

export const rollbackCommentSeen = (
  state: SeenCommentState,
  strictKey: string,
  looseKey: string,
  permalink: string | null,
  commentUid: string | null,
) => {
  state.seenStrict.delete(strictKey);
  state.seenLoose.delete(looseKey);
  if (permalink) state.seenPermalink.delete(permalink);
  if (commentUid) state.seenUid.delete(commentUid);
};

export const shouldProcessCandidate = (
  state: SeenCommentState,
  strictKey: string,
  looseKey: string,
  permalink: string | null,
  commentUid: string | null,
) => {
  if (permalink && state.seenPermalink.has(permalink)) return false;
  if (state.seenStrict.has(strictKey) || state.seenLoose.has(looseKey)) return false;
  if (commentUid && state.seenUid.has(commentUid)) return false;
  return true;
};

const profileUrlFrom = (profilePath: string, profileUrl: string) => {
  if (profileUrl) return profileUrl;
  if (!profilePath) return '';
  return profilePath.startsWith('http') ? profilePath : `https://www.instagram.com${profilePath}`;
};

export const normalizeCommentLikers = (
  raw: RawCommentLiker[] | undefined,
) => {
  const out = [];
  const seen = new Set<string>();
  for (const lk of raw || []) {
    const username = (lk.username || '').trim();
    const profileUrl = profileUrlFrom((lk.profilePath || '').trim(), (lk.profileUrl || '').trim());
    if (!username || !profileUrl) continue;
    const key = username.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ profileUrl, username });
  }
  return out;
};
