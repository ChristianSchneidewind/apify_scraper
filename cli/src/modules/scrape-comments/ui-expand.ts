import { LOAD_MORE_TEXTS } from '../../adapters/instagram/dom-selectors.ts';
import type { ReplyExpansionPage, TimeLocator, VisualPage } from '../../schemas/index.ts';
import { expandCommentControls, expandOneReplyControl } from './browser.ts';

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

const replyClickAttempts = new WeakMap<object, Map<string, number>>();

const readReplyControl = (element: Element) => {
  const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
  const lower = text.toLowerCase();
  const actionWords = ['view', 'show', 'anzeigen', 'ansehen', 'more'];
  const matches = (lower.includes('repl') || lower.includes('antwort'))
    && (actionWords.some((word) => lower.includes(word)) || /\d/.test(lower));
  if (!matches) return null;
  const ancestors: Element[] = [];
  let current: Element | null = element;
  while (current && ancestors.length < 16) {
    ancestors.push(current);
    current = current.parentElement;
  }
  const permalink = ancestors
    .map((ancestor) => ancestor.querySelector('a[href*="/c/"]')?.getAttribute('href') || '')
    .find(Boolean) || '';
  const rowKey = permalink || `${lower}|${element.parentElement?.textContent?.trim().slice(0, 160) || ''}`;
  return { key: `${rowKey}|${element.tagName.toLowerCase()}` };
};

const findClickableReply = async (
  handles: TimeLocator[],
  attempts: Map<string, number>,
): Promise<TimeLocator | null> => {
  const handle = handles[0];
  if (!handle) return null;
  const control = await handle.evaluate(readReplyControl, undefined).catch(() => null);
  const previousAttempts = control ? attempts.get(control.key) || 0 : 3;
  if (!control || previousAttempts >= 3) return findClickableReply(handles.slice(1), attempts);
  attempts.set(control.key, previousAttempts + 1);
  return handle;
};

const clickReplyControlWithPlaywright = async (
  page: ReplyExpansionPage,
) => {
  if (!page.locator) return null;
  const replyText = ':text-matches("(repl|antwort)", "i")';
  const selector = `button${replyText}, [role="button"]${replyText}, a${replyText}, [role="button"] span${replyText}`;
  const handles = await page.locator(selector).elementHandles();
  const attempts = replyClickAttempts.get(page as object) || new Map<string, number>();
  replyClickAttempts.set(page as object, attempts);
  const handle = await findClickableReply(handles, attempts);
  if (!handle) return 0;
  return handle.click({ force: true, timeout: 2000 }).then(() => 1).catch(() => 0);
};

export const expandAllReplyThreads = async (
  page: ReplyExpansionPage,
  maxClicks = 80,
) => {
  let clicked = 0;
  let fallbackAttempts = 0;
  // Instagram batches/re-renders reply controls. Re-query after every trusted
  // Playwright click; evaluate-click is retained only for lightweight tests.
  while (clicked < maxClicks) {
    const playwrightAdded = await clickReplyControlWithPlaywright(page);
    if (playwrightAdded === null && fallbackAttempts >= 3) break;
    const added = playwrightAdded ?? await page.evaluate(expandOneReplyControl, undefined);
    if (!added) break;
    if (playwrightAdded === null) fallbackAttempts += 1;
    clicked += added;
    await page.waitForTimeout?.(300);
  }
  return clicked;
};
