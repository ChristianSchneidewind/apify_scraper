import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COMMENT_TIME_SELECTOR, DIALOG_COMMENT_ROWS_SELECTOR, POST_COMMENT_LAST_RESORT_SELECTOR, POST_COMMENT_LI_ROWS_SELECTOR, POST_COMMENT_ROWS_FALLBACK_SELECTOR } from '../../adapters/instagram/dom-selectors.ts';
import type { CommentPage, CommentRecord, TimeLocator } from '../../schemas/index.ts';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const EXTRACT_TIME_SCRIPT = readFileSync(join(MODULE_DIR, 'browser-scripts/extract-one.script'), 'utf8');
const EXTRACT_ITEM_SCRIPT = readFileSync(join(MODULE_DIR, 'browser-scripts/extract-item.script'), 'utf8');
const LIST_ROWS_SCRIPT = readFileSync(join(MODULE_DIR, 'browser-scripts/list-comment-rows.script'), 'utf8');
const RESOLVE_ROW_SCRIPT = readFileSync(join(MODULE_DIR, 'browser-scripts/resolve-comment-row.script'), 'utf8');
const REFIND_ROW_SCRIPT = readFileSync(join(MODULE_DIR, 'browser-scripts/refind-comment-row.script'), 'utf8');
const UID_SCRIPT = readFileSync(join(MODULE_DIR, 'browser-scripts/compute-comment-uid.script'), 'utf8');
const ROW_SELECTORS = [
  POST_COMMENT_LI_ROWS_SELECTOR,
  DIALOG_COMMENT_ROWS_SELECTOR,
  POST_COMMENT_ROWS_FALLBACK_SELECTOR,
  POST_COMMENT_LAST_RESORT_SELECTOR,
];

const runElementBody = <T>(el: Element, args: { body: string }) =>
  new Function('el', args.body)(el) as T;

const findRowHandlesFallback = async (
  page: CommentPage,
  selectors: readonly string[],
): Promise<TimeLocator[]> => {
  const selector = selectors[0];
  if (typeof selector !== 'string') return [];
  const handles = await page.locator(selector).elementHandles();
  if (handles.length) return handles as TimeLocator[];
  return findRowHandlesFallback(page, selectors.slice(1));
};

const toTimeLocator = async (prop: { asElement: () => Element | null; dispose: () => Promise<void> }) => {
  const element = prop.asElement();
  if (!element) {
    await prop.dispose();
    return null;
  }
  return element as unknown as TimeLocator;
};

const collectRowHandles = async (
  props: Array<{ asElement: () => Element | null; dispose: () => Promise<void> }>,
): Promise<TimeLocator[]> => {
  const prop = props[0];
  if (!prop) return [];
  const handle = await toTimeLocator(prop);
  const tail = await collectRowHandles(props.slice(1));
  return handle ? [handle, ...tail] : tail;
};

export const extractCommentFromTime = async (locator: TimeLocator) =>
  locator.evaluate(runElementBody<CommentRecord | null>, { body: EXTRACT_TIME_SCRIPT });

export const computeCommentUid = async (locator: TimeLocator) =>
  locator.evaluate(runElementBody<string | null>, { body: UID_SCRIPT });

export const resolveCommentRowHandle = async (locator: TimeLocator) => {
  if (!locator.evaluateHandle) return locator;
  const handle = await locator.evaluateHandle(runElementBody<Element | null>, { body: RESOLVE_ROW_SCRIPT });
  return (handle.asElement?.() ?? locator) as unknown as TimeLocator;
};

export const extractCommentFromItem = async (locator: TimeLocator) =>
  locator.evaluate(runElementBody<CommentRecord | null>, { body: EXTRACT_ITEM_SCRIPT });

export const listCommentRowLocators = async (page: CommentPage) => {
  if (!page.evaluateHandle) return findRowHandlesFallback(page, ROW_SELECTORS);
  const handlesArray = await page.evaluateHandle((args: { body: string }) => new Function(`return (${args.body});`)()(), { body: LIST_ROWS_SCRIPT });
  try {
    const props = [...(await handlesArray.getProperties()).values()].filter(Boolean) as Array<{ asElement: () => Element | null; dispose: () => Promise<void> }>;
    return collectRowHandles(props);
  } finally {
    await handlesArray.dispose();
  }
};

export const refindCommentRowHandle = async (
  page: CommentPage,
  data: Pick<CommentRecord, 'commentPermalink' | 'text' | 'userProfilePath' | 'username'>,
) => {
  if (!page.evaluateHandle) return null;
  const payload = { commentPermalink: data.commentPermalink, text: data.text, userProfilePath: data.userProfilePath, username: data.username };
  const handle = await page.evaluateHandle((args: { body: string; payload: Record<string, unknown> }) => {
    const fn = new Function(args.body)() as (payload: Record<string, unknown>) => Element | null;
    return fn(args.payload);
  }, { body: REFIND_ROW_SCRIPT, payload }).catch(() => null);
  return (handle as { asElement?: () => Element | null })?.asElement?.() as unknown as TimeLocator | null;
};

export const listTimeLocators = async (page: CommentPage) => {
  const isReelsFeed = typeof page.evaluate === 'function'
    ? await page.evaluate(() => /\/reels?\//.test(location.pathname), undefined)
    : false;
  return page.locator(isReelsFeed ? 'div[role="dialog"] time' : COMMENT_TIME_SELECTOR).elementHandles();
};
