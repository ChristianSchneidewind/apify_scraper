export const buildCommentIdentity = (data: {
  username?: string;
  text?: string;
  datetime?: string | null;
  timeText?: string;
  isGifOnly?: boolean;
}) => {
  const username = (data.username || '').trim().toLowerCase();
  const text = (data.text || '').trim().toLowerCase();
  const dt = (data.datetime || '').trim().toLowerCase();
  const tt = (data.timeText || '').trim().toLowerCase();
  const isGif = Boolean(data.isGifOnly);
  const strictKey = `${username}|${text}|${dt}`;
  const looseKey = isGif
    ? `gif|${username}|${tt || dt}`
    : `txt|${username}|${text}|${tt || dt}`;
  return { looseKey, strictKey };
};

export const registerCommentSeen = (
  state: { seenLoose: Set<string>; seenStrict: Set<string>; seenUid: Set<string> },
  strictKey: string,
  looseKey: string,
  commentUid: string | null,
) => {
  state.seenStrict.add(strictKey);
  state.seenLoose.add(looseKey);
  if (commentUid) state.seenUid.add(commentUid);
};

export const rollbackCommentSeen = (
  state: { seenLoose: Set<string>; seenStrict: Set<string>; seenUid: Set<string> },
  strictKey: string,
  looseKey: string,
  commentUid: string | null,
) => {
  state.seenStrict.delete(strictKey);
  state.seenLoose.delete(looseKey);
  if (commentUid) state.seenUid.delete(commentUid);
};

export const shouldProcessCandidate = (
  state: { seenLoose: Set<string>; seenStrict: Set<string>; seenUid: Set<string> },
  strictKey: string,
  looseKey: string,
  commentUid: string | null,
) => {
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
  raw: Array<{ profilePath?: string; profileUrl?: string; username?: string }> | undefined,
) => {
  const out = [];
  for (const lk of raw || []) {
    const username = (lk.username || '').trim();
    const profileUrl = profileUrlFrom((lk.profilePath || '').trim(), (lk.profileUrl || '').trim());
    if (username && profileUrl) out.push({ profileUrl, username });
  }
  return out;
};
