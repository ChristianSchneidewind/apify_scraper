import type { CommentPage } from '../../schemas/index.ts';
import { focusFirstCommentRow, resetCommentScroll } from './comment-scroll-reset.ts';
import { getCommentContainer } from './ui-container.ts';
import { expandAllReplyThreads, expandComments } from './ui-expand.ts';
import { openCommentsPanel } from './page-setup.ts';
import { scrollCommentContainer } from './ui-scroll.ts';

const countTimes = (page: CommentPage) => page.locator('time').count();

export const resetCommentsToTop = async (page: CommentPage) => {
  const container = await getCommentContainer(page);
  // resetCommentScroll has a Reel-specific path that only resets the internal
  // comments dialog and never moves the Reel feed itself.
  await resetCommentScroll(page, container);
  await focusFirstCommentRow(page);
  return container;
};

const expandRound = (page: CommentPage) => Promise.all([expandComments(page, 20), expandAllReplyThreads(page, 80)]);

const rescanRound = async (page: CommentPage) => {
  const container = await getCommentContainer(page);
  await resetCommentScroll(page, container);
  await openCommentsPanel(page);
  await expandComments(page, 40);
  await expandAllReplyThreads(page, 80);
  await scrollCommentContainer(page, container, 3);
  return container;
};

export const loadAllComments = async (
  page: CommentPage,
  maxRounds: number,
  idleRounds: number,
) => {
  let rounds = 0;
  let idle = 0;
  let lastCount = 0;
  while (rounds < maxRounds && idle < idleRounds) {
    const currentCount = await countTimes(page);
    await openCommentsPanel(page);
    await expandRound(page);
    const container = await getCommentContainer(page);
    await scrollCommentContainer(page, container, 5);
    await page.waitForTimeout(1000);
    const nextCount = await countTimes(page);
    const gained = nextCount > lastCount;
    lastCount = gained ? nextCount : lastCount;
    idle = gained ? 0 : idle + 1;
    rounds += 1;
    if (currentCount === 0 && nextCount === 0) continue;
  }
  return { idle, lastCount, rounds };
};

export const rescanComments = async (page: CommentPage) => rescanRound(page);
