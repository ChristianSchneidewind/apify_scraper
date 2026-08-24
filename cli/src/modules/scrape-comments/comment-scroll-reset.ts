import type { CommentContainer, CommentPage } from '../../schemas/index.ts';
import { resetCommentsScroll } from './browser.ts';
import { listCommentRowLocators } from './extract-from-locator.ts';

export const resetCommentScroll = async (page: CommentPage, container: CommentContainer) => {
  await page.evaluate(resetCommentsScroll, container);
  await page.waitForTimeout(800);
};

export const focusFirstCommentRow = async (page: CommentPage) => {
  const isReelsFeed = await page.evaluate(() => /\/reels?\//.test(location.pathname), undefined);
  // Calling scrollIntoView on a virtualized Reel row can scroll the page
  // (including the description column) instead of the comments pane.
  if (isReelsFeed) return false;
  const rows = await listCommentRowLocators(page);
  const row = rows[0];
  if (!row?.evaluate) return false;
  await row.evaluate((el: Element) => (el.scrollIntoView({ block: 'center', inline: 'nearest' }), true), undefined);
  await page.waitForTimeout(400);
  return true;
};
