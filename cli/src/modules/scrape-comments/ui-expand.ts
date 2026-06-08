import { LOAD_MORE_TEXTS } from '../../adapters/instagram/dom-selectors.ts';

const shouldSkipText = (lower: string) =>
  lower === 'reply' || lower === 'antworten';

const shouldExpandText = (text: string, lower: string, texts: readonly string[]) => {
  const looksLikeReplies = (lower.includes('repl') || lower.includes('antwort')) && /\d/.test(text);
  const looksLikeView = lower.includes('view') || lower.includes('more') || lower.includes('anzeigen');
  return texts.some((item) => text.includes(item)) || (looksLikeReplies && looksLikeView);
};

const expandCommentUi = (texts: readonly string[]) => {
  let count = 0;
  const nodes = document.querySelectorAll('button, [role="button"], a, span[role="button"]');
  for (const el of nodes) {
    const text = (el.textContent || '').trim();
    if (!text) continue;
    const lower = text.toLowerCase();
    if (shouldSkipText(lower)) continue;
    if (!shouldExpandText(text, lower, texts)) continue;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    count += 1;
  }
  return count;
};

export const expandComments = async (
  page: { evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T> },
  maxClicks = 30,
) => {
  let clicks = 0;
  while (clicks < maxClicks) {
    const added = await page.evaluate(expandCommentUi, LOAD_MORE_TEXTS);
    if (!added) break;
    clicks += added;
  }
  return clicks;
};
