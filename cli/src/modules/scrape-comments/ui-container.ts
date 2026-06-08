import { COMMENT_CONTAINER_SELECTORS } from '../../adapters/instagram/dom-selectors.ts';

const findCommentContainer = (selectors: readonly string[]) => {
  for (const selector of selectors) {
    const node = document.querySelector(selector);
    if (node) return node;
  }
  return null;
};

export const getCommentContainer = async (
  page: { evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T> },
) => page.evaluate(findCommentContainer, COMMENT_CONTAINER_SELECTORS);
