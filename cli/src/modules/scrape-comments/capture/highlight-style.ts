import type { ElementHandle } from '../../../schemas/index.ts';
import { reinforceHighlight } from './browser.ts';

export const reinforceHighlightStyles = async (handle: ElementHandle) =>
  handle.evaluate(reinforceHighlight, undefined);
