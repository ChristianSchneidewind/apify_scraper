import type { OpenLikesResult, TimeLocator } from '../../../schemas/index.ts';
import { findInlineLikesTarget } from './browser.ts';

export const openLikesInline = async (
  handle: TimeLocator,
  commentPermalink: string | null,
) => {
  const result: OpenLikesResult | null = await handle.evaluate(
    findInlineLikesTarget,
    commentPermalink,
  );
  if (!result?.clicked || !handle.evaluateHandle) {
    return result || { clicked: false, likesCount: 0, ok: false, reason: 'invalid_result' };
  }
  const marked = await handle.evaluateHandle(
    (element: Element) => element.ownerDocument.querySelector('[data-instagram-cli-likes-target="1"]'),
    undefined,
  );
  try {
    const target = marked.asElement();
    if (!target) return { ...result, clicked: false, reason: 'likes_target_handle_missing' };
    await target.click({ timeout: 2000 });
    return result;
  } catch {
    return { ...result, clicked: false, reason: 'likes_target_click_failed' };
  } finally {
    await marked.dispose();
  }
};
