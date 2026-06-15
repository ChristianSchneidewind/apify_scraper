import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSafeClickHelpers } from '../../../adapters/instagram/safe-click.ts';
import { injectHelpers } from '../../../adapters/instagram/load-script.ts';
import type { OpenLikesResult } from '../../../schemas/index.ts';

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
  handle: { evaluate: <T, A>(fn: (el: Element, args: A) => T, args: A) => Promise<T> },
  commentPermalink: string | null,
) => {
  const result = await handle.evaluate(runPayloadBody<OpenLikesResult>, {
    body: OPEN_LIKES_SCRIPT,
    commentPermalink,
  });
  return result || { clicked: false, likesCount: 0, ok: false, reason: 'invalid_result' };
};
