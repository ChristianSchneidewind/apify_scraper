import { COMMENT_CONTAINER_SELECTORS } from '../../adapters/instagram/dom-selectors.ts';
import type { VisualPage } from '../../schemas/index.ts';

function findCommentContainer(selectors: readonly string[]) {
  if (/\/reels?\//.test(location.pathname)) return null;
  for (const selector of selectors) {
    const node = document.querySelector(selector);
    if (node) return selector;
  }
  return null;
}

export const getCommentContainer = async (page: VisualPage) => page.evaluate(findCommentContainer, COMMENT_CONTAINER_SELECTORS);
