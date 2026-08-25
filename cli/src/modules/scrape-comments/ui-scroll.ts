import type { CommentContainer, VisualPage } from '../../schemas/index.ts';
import { scrollComments } from './browser.ts';

const runScroll = (page: VisualPage, container: CommentContainer) =>
  page.evaluate(scrollComments, container);

export const scrollCommentContainer = async (
  page: VisualPage,
  container: CommentContainer,
  rounds = 3,
) => {
  let moved = false;
  for (let index = 0; index < rounds; index += 1) {
    const result = await runScroll(page, container);
    moved = moved || Boolean(result);
    if (!result) break;
    await page.waitForTimeout(1200);
  }
  return moved;
};
