import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CommentPage } from '../../schemas/index.ts';
import { listCommentRowLocators } from './extract-from-locator.ts';
import { getCommentContainer } from './ui-container.ts';
import { expandAllReplyThreads, expandComments } from './ui-expand.ts';
import { openCommentsPanel } from './page-setup.ts';
import { scrollCommentContainer } from './ui-scroll.ts';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const RESET_SCROLL_SCRIPT = readFileSync(join(MODULE_DIR, 'browser-scripts/reset-scroll.script'), 'utf8');
const countTimes = (page: CommentPage) => page.locator('time').count();

const runBrowserScript = async (
  page: CommentPage,
  body: string,
  container: Element | null,
) => {
  await page.evaluate((args: { body: string; container: Element | null }) =>
    new Function(`return (${args.body});`)()(args.container),
  { body, container });
};

const resetScroll = async (page: CommentPage, container: Element | null) => {
  await runBrowserScript(page, RESET_SCROLL_SCRIPT, container);
  await page.waitForTimeout(800);
};

const focusFirstCommentRow = async (page: CommentPage) => {
  const rows = await listCommentRowLocators(page as never);
  const row = rows[0];
  if (!row?.evaluate) return false;
  await row.evaluate((el: Element) => (el.scrollIntoView({ block: 'center', inline: 'nearest' }), true), undefined as never);
  await page.waitForTimeout(400);
  return true;
};

export const resetCommentsToTop = async (page: CommentPage) => {
  const container = await getCommentContainer(page);
  await resetScroll(page, container);
  await focusFirstCommentRow(page);
  return container;
};

const expandRound = (page: CommentPage) => Promise.all([expandComments(page, 20), expandAllReplyThreads(page, 80)]);

const rescanRound = async (page: CommentPage) => {
  const container = await getCommentContainer(page);
  await resetScroll(page, container);
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
