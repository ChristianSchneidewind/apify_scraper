import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareAuthPage } from '../../adapters/instagram/auth.ts';
import type { CommentPage } from '../../schemas/index.ts';
import { expandAllReplyThreads, expandComments } from './ui-expand.ts';
import { getCommentContainer } from './ui-container.ts';
import { listCommentRowLocators } from './extract-from-locator.ts';
import { scrollCommentContainer } from './ui-scroll.ts';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const RESET_SCROLL_SCRIPT = readFileSync(join(MODULE_DIR, 'browser-scripts/reset-scroll.script'), 'utf8');

const COMMENT_BUTTON_SELECTORS = [
  'button[aria-label="Comment"]',
  'button[aria-label*="Comments"]',
  'button[aria-label*="Komment"]',
  '[role="button"][aria-label="Comment"]',
  '[role="button"][aria-label*="Comments"]',
  '[role="button"][aria-label*="Komment"]',
  'a[href*="/comments/"]',
  'button:has-text("View all comments")',
  'button:has-text("View comments")',
  'button:has-text("Comments")',
  'button:has-text("Kommentare")',
  'a:has-text("View all comments")',
  'a:has-text("Kommentare")',
];

const countTimes = (page: CommentPage) => page.locator('time').count();

const clickTarget = async (page: CommentPage, target: { click: (opts: { timeout: number }) => Promise<void> }) => {
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
  return false;
};

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

const preparePanel = async (page: CommentPage) => {
  const opened = await openCommentsPanel(page);
  if (opened) return;
  if (await countTimes(page) === 0) await openCommentsPanel(page);
};

const loadCommentsRound = async (page: CommentPage, maxUiRounds: number) => {
  const expanded = await expandComments(page, Math.min(12, Math.max(4, maxUiRounds)));
  const replies = await expandAllReplyThreads(page, 80);
  const container = await getCommentContainer(page);
  const scrolled = await scrollCommentContainer(page, container, 8);
  return expanded > 0 || replies > 0 || scrolled;
};

const loadCommentsPage = async (page: CommentPage, maxUiRounds: number) => {
  for (let round = 0; round < maxUiRounds; round += 1) {
    const moved = await loadCommentsRound(page, maxUiRounds);
    await page.waitForTimeout(750);
    if (!moved) break;
  }
};

export const openCommentsPanel = async (page: CommentPage) => clickFirstCommentButton(page);

export const prepareCommentsPage = async (
  page: CommentPage,
  maxUiRounds: number,
  uiIdleRounds: number,
) => {
  await prepareAuthPage(page as never);
  await preparePanel(page);
  await loadCommentsPage(page, maxUiRounds);
  const container = await getCommentContainer(page);
  await resetScroll(page, container);
  await focusFirstCommentRow(page);
  await page.waitForTimeout(Math.min(1500, Math.max(500, uiIdleRounds * 250)));
};
