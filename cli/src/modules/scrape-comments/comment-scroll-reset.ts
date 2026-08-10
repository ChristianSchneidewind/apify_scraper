import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CommentPage } from '../../schemas/index.ts';
import { listCommentRowLocators } from './extract-from-locator.ts';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const RESET_SCROLL_SCRIPT = readFileSync(join(MODULE_DIR, 'browser-scripts/reset-scroll.script'), 'utf8');

const runBrowserScript = async (
  page: CommentPage,
  body: string,
  container: Element | null,
) => {
  await page.evaluate((args: { body: string; container: Element | null }) =>
    new Function(`return (${args.body});`)()(args.container),
  { body, container });
};

export const resetCommentScroll = async (page: CommentPage, container: Element | null) => {
  await runBrowserScript(page, RESET_SCROLL_SCRIPT, container);
  await page.waitForTimeout(800);
};

export const focusFirstCommentRow = async (page: CommentPage) => {
  const rows = await listCommentRowLocators(page as never);
  const row = rows[0];
  if (!row?.evaluate) return false;
  await row.evaluate((el: Element) => (el.scrollIntoView({ block: 'center', inline: 'nearest' }), true), undefined as never);
  await page.waitForTimeout(400);
  return true;
};
