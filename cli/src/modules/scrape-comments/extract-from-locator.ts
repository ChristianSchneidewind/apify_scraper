import { COMMENT_TIME_SELECTOR, DIALOG_COMMENT_ROWS_SELECTOR, POST_COMMENT_LAST_RESORT_SELECTOR, POST_COMMENT_LI_ROWS_SELECTOR, POST_COMMENT_ROWS_FALLBACK_SELECTOR } from '../../adapters/instagram/dom-selectors.ts';
import type { BrowserHandle, CommentPage, CommentRecord, RefindCommentPayload, TimeLocator } from '../../schemas/index.ts';
import {
  computeCommentUidBrowser,
  extractCommentBrowser,
  listCommentRowsBrowser,
  readParentCommentPermalink,
  refindCommentRowBrowser,
  resolveCommentRowBrowser,
} from './browser-extract.ts';
const ROW_SELECTORS = [
  POST_COMMENT_LI_ROWS_SELECTOR,
  DIALOG_COMMENT_ROWS_SELECTOR,
  POST_COMMENT_ROWS_FALLBACK_SELECTOR,
  POST_COMMENT_LAST_RESORT_SELECTOR,
];

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

const toTimeLocator = async (prop: BrowserHandle) => {
  const element = prop.asElement();
  if (!element) {
    await prop.dispose();
    return null;
  }
  return element;
};

const collectRowHandles = async (
  props: BrowserHandle[],
): Promise<TimeLocator[]> => {
  const prop = props[0];
  if (!prop) return [];
  const handle = await toTimeLocator(prop);
  const tail = await collectRowHandles(props.slice(1));
  return handle ? [handle, ...tail] : tail;
};

const attachParentPermalink = async (
  locator: TimeLocator,
  comment: CommentRecord | null,
): Promise<CommentRecord | null> => {
  if (!comment) return null;
  const parentCommentPermalink = await locator.evaluate(readParentCommentPermalink, undefined);
  return { ...comment, parentCommentPermalink };
};

export const extractCommentFromTime = async (locator: TimeLocator) => {
  const comment = await locator.evaluate(extractCommentBrowser, true);
  return attachParentPermalink(locator, comment);
};

export const computeCommentUid = async (locator: TimeLocator) =>
  locator.evaluate(computeCommentUidBrowser, undefined);

export const resolveCommentRowHandle = async (locator: TimeLocator) => {
  if (!locator.evaluateHandle) return locator;
  const handle = await locator.evaluateHandle(resolveCommentRowBrowser, undefined);
  return handle.asElement() ?? locator;
};

export const extractCommentFromItem = async (locator: TimeLocator) => {
  const comment = await locator.evaluate(extractCommentBrowser, false);
  return attachParentPermalink(locator, comment);
};

export const listCommentRowLocators = async (page: CommentPage) => {
  if (!page.evaluateHandle) return findRowHandlesFallback(page, ROW_SELECTORS);
  const handlesArray = await page.evaluateHandle(listCommentRowsBrowser, undefined);
  try {
    const props = [...(await handlesArray.getProperties()).values()].filter(Boolean);
    return collectRowHandles(props);
  } finally {
    await handlesArray.dispose();
  }
};

export const refindCommentRowHandle = async (
  page: CommentPage,
  data: RefindCommentPayload,
) => {
  if (!page.evaluateHandle) return null;
  const payload: RefindCommentPayload = { commentPermalink: data.commentPermalink, text: data.text, userProfilePath: data.userProfilePath, username: data.username };
  const handle = await page.evaluateHandle(refindCommentRowBrowser, payload).catch(() => null);
  return handle?.asElement() || null;
};

export const listTimeLocators = async (page: CommentPage) => {
  const isReelsFeed = typeof page.evaluate === 'function'
    ? await page.evaluate(() => /\/reels?\//.test(location.pathname), undefined)
    : false;
  return page.locator(isReelsFeed ? 'div[role="dialog"] time' : COMMENT_TIME_SELECTOR).elementHandles();
};
