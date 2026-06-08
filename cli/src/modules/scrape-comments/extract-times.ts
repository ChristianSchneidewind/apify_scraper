import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMENT_TIME_SELECTOR } from '../../adapters/instagram/dom-selectors.ts';
import type { CommentRecord } from '../../schemas/index.ts';

const scriptPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'browser-scripts/extract-times.script',
);
const EXTRACT_TIMES_BROWSER_SCRIPT = readFileSync(scriptPath, 'utf8');

const runExtractPayload = (payload: { script: string; timeSelector: string }) =>
  new Function('timeSelector', payload.script)(payload.timeSelector);

export const extractCommentsFromTimes = async (
  page: { evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T> },
) => page.evaluate(runExtractPayload, {
  script: EXTRACT_TIMES_BROWSER_SCRIPT,
  timeSelector: COMMENT_TIME_SELECTOR,
}) as Promise<CommentRecord[]>;
