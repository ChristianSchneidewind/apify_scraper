import type { LikersPage } from '../../../schemas/index.ts';
import { openLikesDeepLink } from './open-deep.ts';

const closePage = (page: LikersPage) =>
  page.close().catch(() => undefined);

const openContextPage = async (page: LikersPage) =>
  page.context().newPage();

export const tryDeepFallback = async (
  page: LikersPage,
  commentUrl: string,
  commentPermalink: string,
  likesCount: number,
  verbose?: boolean,
) => {
  const nextPage = await Promise.allSettled([openContextPage(page)]);
  if (nextPage[0]?.status !== 'fulfilled') return { likesCount, page, reason: 'deep_new_page_failed', worked: false };
  const deepPage = nextPage[0].value;
  const deep = await Promise.allSettled([openLikesDeepLink(deepPage, commentUrl, commentPermalink, verbose)]);
  if (deep[0]?.status !== 'fulfilled') {
    await closePage(deepPage);
    return { likesCount, page, reason: 'deep_open_failed', worked: false };
  }
  const result = deep[0].value;
  const deepLikes = Number(result.likesCount ?? likesCount);
  if (!result.clicked) {
    await closePage(deepPage);
    return { likesCount: deepLikes, page, reason: result.reason, worked: false };
  }
  await deepPage.waitForTimeout(1200);
  return { likesCount: deepLikes, page: deepPage, reason: result.reason, worked: true };
};
