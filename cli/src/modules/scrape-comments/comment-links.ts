export const buildCommentLinks = (commentPermalink: string | null, sourceUrl: string) => {
  const commentUrl = commentPermalink && commentPermalink.startsWith('/')
    ? `https://www.instagram.com${commentPermalink}`
    : commentPermalink;

  let commentDeepLink: string | null = null;
  const commentId = typeof commentPermalink === 'string'
    ? (commentPermalink.match(/\/c\/(\d+)/)?.[1] ?? null)
    : null;

  if (commentId) {
    const basePostUrl = (sourceUrl.split('?').at(0) ?? '').replace('/reels/', '/reel/');
    const separator = basePostUrl.includes('?') ? '&' : '?';
    commentDeepLink = `${basePostUrl}${separator}comment_id=${commentId}`;
  }

  return { commentDeepLink, commentUrl };
};
