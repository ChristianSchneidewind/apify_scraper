import { LOAD_MORE_TEXTS } from '../../adapters/instagram/dom-selectors.ts';
import type { ReplyExpansionPage, VisualPage } from '../../schemas/index.ts';
import { expandCommentControls } from './browser.ts';

export const expandComments = async (
  page: VisualPage,
  maxClicks = 30,
) => {
  let clicks = 0;
  while (clicks < maxClicks) {
    const added = await page.evaluate(expandCommentControls, LOAD_MORE_TEXTS);
    if (!added) break;
    clicks += added;
  }
  return clicks;
};

const REPLY_ACTION_WORDS = ['view', 'show', 'anzeigen', 'ansehen', 'more'];
const REPLY_ATTEMPT_ATTR = 'data-cdp-reply-attempted';
const REPLY_CANDIDATE_SELECTOR = 'button, [role="button"], a, [role="button"] span';

const readReplyText = (element: Element) =>
  (element.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();

const isReplyControl = (element: Element) => {
  const text = readReplyText(element);
  const mentionsReplies = text.includes('repl') || text.includes('antwort');
  return mentionsReplies && (REPLY_ACTION_WORDS.some((word) => text.includes(word)) || /\d/.test(text));
};

const attemptReplyClick = (element: Element) => {
  const attempts = Number(element.getAttribute(REPLY_ATTEMPT_ATTR) || 0);
  if (attempts >= 3) return false;
  element.setAttribute(REPLY_ATTEMPT_ATTR, String(attempts + 1));
  (element as HTMLElement).click();
  return true;
};

// Instagram batches and re-renders reply controls, so every click re-queries
// the DOM; per-control attempts are tracked in-page via a data attribute.
const clickReplyControlBrowser = () => {
  const candidates = Array.from(document.querySelectorAll(REPLY_CANDIDATE_SELECTOR));
  const target = candidates.find((element) => isReplyControl(element));
  if (!target) return 0;
  return attemptReplyClick(target) ? 1 : 0;
};

export const expandAllReplyThreads = async (
  page: ReplyExpansionPage,
  maxClicks = 80,
) => {
  let clicked = 0;
  while (clicked < maxClicks) {
    const added = await page.evaluate(clickReplyControlBrowser, undefined).catch(() => 0);
    if (!added) break;
    clicked += added;
    await page.waitForTimeout?.(300);
  }
  return clicked;
};
