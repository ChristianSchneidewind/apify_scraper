import { isLoginRequired, prepareAuthPage } from '../../adapters/instagram/auth.ts';
import type { CommentPage, TimeLocator } from '../../schemas/index.ts';
import { focusFirstCommentRow, resetCommentScroll } from './comment-scroll-reset.ts';
import { expandAllReplyThreads, expandComments } from './ui-expand.ts';
import { getCommentContainer } from './ui-container.ts';
import { scrollCommentContainer } from './ui-scroll.ts';
import { openReelComments } from './browser.ts';
import {
  clickNewestCommentSort,
  openCommentSortMenu,
  readCommentSort,
} from './browser-sort.ts';

const COMMENT_BUTTON_SELECTORS = [
  'button[aria-label="Comment"]',
  'button[aria-label*="Comments"]',
  'button[aria-label*="Komment"]',
  '[role="button"][aria-label="Comment"]',
  '[role="button"][aria-label*="Comments"]',
  '[role="button"][aria-label*="Komment"]',
  'a[href*="/comments/"]',
];

const COMMENT_BUTTON_TEXT = /^(view( all \d*)? comments?|kommentare( ansehen)?)$/i;

// Text-based fallback for controls without aria-label (CSS cannot match
// text); runs in the page because :has-text is a Playwright-only engine.
const clickCommentButtonByTextBrowser = () => {
  const candidates = Array.from(document.querySelectorAll('button, a, [role="button"]'));
  const target = candidates.find((el) => COMMENT_BUTTON_TEXT.test((el.textContent || '').trim()));
  if (!target) return false;
  (target as HTMLElement).click();
  return true;
};

const countTimes = (page: CommentPage) => page.locator('time').count();

const lockReelPageScroll = () => {
  const html = document.documentElement;
  const body = document.body;
  html.style.overscrollBehavior = 'none';
  body.style.overscrollBehavior = 'none';
  const top = window.scrollY;
  const left = window.scrollX;
  window.addEventListener('scroll', () => {
    if (window.scrollY !== top || window.scrollX !== left) window.scrollTo(left, top);
  }, { passive: true });
  window.addEventListener('wheel', (event) => {
    const target = event.target as Element | null;
    if (!target?.closest?.('[role="dialog"]')) event.preventDefault();
  }, { capture: true, passive: false });
  return true;
};

const clickTarget = async (page: CommentPage, target: TimeLocator) => {
  try {
    await target.click({ timeout: 2000 });
    await page.waitForTimeout(1200);
    return true;
  } catch {
    return false;
  }
};

const clickSelector = async (page: CommentPage, selector: string) => {
  const locator = page.locator(selector);
  if ((await locator.count()) === 0) return false;
  const handles = await locator.elementHandles();
  for (const target of handles) {
    if (await clickTarget(page, target)) return true;
  }
  return false;
};

const clickFirstCommentButton = async (page: CommentPage) => {
  for (const selector of COMMENT_BUTTON_SELECTORS) {
    if (await clickSelector(page, selector)) return true;
  }
  const clickedByText = await page.evaluate(clickCommentButtonByTextBrowser, undefined).catch(() => false);
  if (clickedByText) await page.waitForTimeout(1200);
  return clickedByText;
};

const preparePanel = async (page: CommentPage) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (await openCommentsPanel(page)) return;
    await page.waitForTimeout(500);
  }
  if (await countTimes(page) === 0) await openCommentsPanel(page);
};

const loadCommentsRound = async (page: CommentPage, maxUiRounds: number) => {
  const expanded = await expandComments(page, Math.min(12, Math.max(4, maxUiRounds)));
  const container = await getCommentContainer(page);
  const scrolled = await scrollCommentContainer(page, container, 8);
  return expanded > 0 || scrolled;
};

const loadCommentsPage = async (page: CommentPage, maxUiRounds: number) => {
  for (let round = 0; round < maxUiRounds; round += 1) {
    const moved = await loadCommentsRound(page, maxUiRounds);
    await page.waitForTimeout(750);
    if (!moved) break;
  }
};

const expandReplyThreadsPage = async (page: CommentPage, maxUiRounds: number) => {
  const container = await getCommentContainer(page);
  await resetCommentScroll(page, container);
  let idleRounds = 0;
  let clickedTotal = 0;
  for (let round = 0; round < maxUiRounds && idleRounds < 2; round += 1) {
    const clicked = await expandAllReplyThreads(page, 100);
    clickedTotal += clicked;
    if (clicked > 0) await page.waitForTimeout(700);
    // Advance one viewport only. Larger jumps can skip reply controls in
    // Instagram's virtualized Reel comments list.
    const moved = await scrollCommentContainer(page, container, 1);
    idleRounds = clicked === 0 && !moved ? idleRounds + 1 : 0;
  }
  return clickedTotal;
};

const selectNewestSafely = (page: CommentPage) =>
  selectNewestCommentSort(page).catch(() => 'sort_selection_failed');

const loadNewestComments = async (page: CommentPage, maxUiRounds: number) => {
  let commentSort = await selectNewestSafely(page);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (commentSort === 'selected_newest') await page.waitForTimeout(2000);
    await loadCommentsPage(page, maxUiRounds);
    await expandReplyThreadsPage(page, maxUiRounds);
    const verified = await selectNewestSafely(page);
    if (verified === 'already_newest') return verified;
    if (verified !== 'selected_newest') return verified;
    commentSort = verified;
  }
  await page.waitForTimeout(2000);
  return commentSort;
};

export const openCommentsPanel = async (page: CommentPage) => {
  if (await page.locator('[role="dialog"]').count()) return true;
  const isReelsFeed = await page.evaluate(() => /\/reels?\//.test(location.pathname), undefined);
  if (isReelsFeed) {
    return page.evaluate(openReelComments, undefined);
  }
  return clickFirstCommentButton(page);
};

const verifyNewestSort = async (page: CommentPage) => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await page.waitForTimeout(150);
    const state = await page.evaluate(readCommentSort, undefined);
    if (state === 'already_newest') return true;
  }
  return false;
};

export const selectNewestCommentSort = async (page: CommentPage) => {
  if (await page.evaluate(readCommentSort, undefined) === 'already_newest') {
    return 'already_newest';
  }
  if (!(await page.evaluate(openCommentSortMenu, undefined))) {
    return 'sort_control_not_found';
  }
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await page.waitForTimeout(150);
    if (!(await page.evaluate(clickNewestCommentSort, undefined))) continue;
    const verified = await verifyNewestSort(page);
    return verified ? 'selected_newest' : 'sort_selection_not_applied';
  }
  return 'newest_option_not_found';
};

export const prepareCommentsPage = async (
  page: CommentPage,
  maxUiRounds: number,
  uiIdleRounds: number,
) => {
  await prepareAuthPage(page);
  if (await isLoginRequired(page)) {
    throw new Error('Instagram session expired; run auth login first');
  }
  const isReelsFeed = await page.evaluate(() => /\/reels?\//.test(location.pathname), undefined);
  if (isReelsFeed) await page.evaluate(lockReelPageScroll, undefined);
  await preparePanel(page);
  // Loading can re-render the Reel dialog and restore "For you". Select and
  // verify "Newest" around the complete load/reply-expansion phase.
  const commentSort = await loadNewestComments(page, maxUiRounds);
  const container = await getCommentContainer(page);
  await resetCommentScroll(page, container);
  await page.waitForTimeout(700);
  await focusFirstCommentRow(page);
  await page.waitForTimeout(Math.min(1500, Math.max(500, uiIdleRounds * 250)));
  return commentSort;
};
