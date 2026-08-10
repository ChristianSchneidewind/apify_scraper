import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ElementHandle } from '../../../schemas/index.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const REINFORCE_HIGHLIGHT_SCRIPT = readFileSync(join(dir, 'browser-scripts/reinforce-highlight.script'), 'utf8');

export const reinforceHighlightStyles = async (handle: ElementHandle) =>
  handle.evaluate((el: Element, args: { body: string }) => new Function('el', args.body)(el), {
    body: REINFORCE_HIGHLIGHT_SCRIPT,
  });
