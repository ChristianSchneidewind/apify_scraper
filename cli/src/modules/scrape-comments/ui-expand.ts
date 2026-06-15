import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOAD_MORE_TEXTS } from '../../adapters/instagram/dom-selectors.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const EXPAND_SCRIPT = readFileSync(join(dir, 'browser-scripts/expand-comments.script'), 'utf8');

const loadExpandScript = () => new Function(
  EXPAND_SCRIPT.replace('__LOAD_MORE_TEXTS__', JSON.stringify(LOAD_MORE_TEXTS)),
)() as {
  expandCommentUi: (texts: readonly string[]) => number;
  expandReplyThreadsUi: (maxClicks: number) => number;
  LOAD_MORE_TEXTS: readonly string[];
};

export const expandComments = async (
  page: { evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T> },
  maxClicks = 30,
) => {
  const script = loadExpandScript();
  let clicks = 0;
  while (clicks < maxClicks) {
    const added = await page.evaluate(script.expandCommentUi, script.LOAD_MORE_TEXTS);
    if (!added) break;
    clicks += added;
  }
  return clicks;
};

export const expandAllReplyThreads = async (
  page: { evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T> },
  maxClicks = 80,
) => {
  const script = loadExpandScript();
  return page.evaluate(script.expandReplyThreadsUi, maxClicks);
};
