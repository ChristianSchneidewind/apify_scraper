import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSafeClickHelpers } from '../../../adapters/instagram/safe-click.ts';
import { injectHelpers } from '../../../adapters/instagram/load-script.ts';
import type { OpenLikesResult, TimeLocator } from '../../../schemas/index.ts';

const OPEN_LIKES_SCRIPT = injectHelpers(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'browser-scripts/open-likes-inline.script'),
    'utf8',
  ),
  buildSafeClickHelpers({ includeLikeText: true }),
);

function runPayloadBody<T>(
  el: Element,
  args: { body: string; commentPermalink: string | null },
) {
  const fn = new Function(args.body)() as (payload: Record<string, unknown>) => T;
  return fn({ commentPermalink: args.commentPermalink, el });
}

export const openLikesInline = async (
  handle: TimeLocator,
  commentPermalink: string | null,
) => {
  const result = await handle.evaluate(runPayloadBody<OpenLikesResult>, {
    body: OPEN_LIKES_SCRIPT,
    commentPermalink,
  });
  if (!result?.clicked || !handle.evaluateHandle) {
    return result || { clicked: false, likesCount: 0, ok: false, reason: 'invalid_result' };
  }
  const marked = await handle.evaluateHandle(
    (element: Element) => element.ownerDocument.querySelector('[data-instagram-cli-likes-target="1"]'),
    undefined as never,
  );
  try {
    const target = marked.asElement() as { click?: (options: { timeout: number }) => Promise<void> } | null;
    if (!target?.click) return { ...result, clicked: false, reason: 'likes_target_handle_missing' };
    await target.click({ timeout: 2000 });
    return result;
  } catch {
    return { ...result, clicked: false, reason: 'likes_target_click_failed' };
  } finally {
    await marked.dispose();
  }
};
