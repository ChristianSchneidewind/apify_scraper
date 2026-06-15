import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const SCROLL_SCRIPT = readFileSync(join(MODULE_DIR, 'browser-scripts/scroll-comment-container.script'), 'utf8');

const runScrollScript = (
  page: { evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>; waitForTimeout: (ms: number) => Promise<void> },
  container: Element | null,
) => page.evaluate((args: { body: string; container: Element | null }) => new Function(`return (${args.body});`)()(args.container), { body: SCROLL_SCRIPT, container });

export const scrollCommentContainer = async (
  page: { evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>; waitForTimeout: (ms: number) => Promise<void> },
  container: Element | null,
  rounds = 3,
) => {
  let moved = false;
  for (let i = 0; i < rounds; i += 1) {
    const result = await runScrollScript(page, container);
    moved = moved || Boolean(result);
    if (!result) break;
    await page.waitForTimeout(1200);
  }
  return moved;
};
