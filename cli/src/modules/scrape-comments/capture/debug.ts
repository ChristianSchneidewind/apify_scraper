import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeBinaryFile, writeJsonFile } from '../../../adapters/filesystem/output.ts';
import type { CommentRecord, DebugPage } from '../../../schemas/index.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const DEBUG_DOM_SCRIPT = readFileSync(join(dir, 'browser-scripts/debug-dom.script'), 'utf8');
const encoder = new TextEncoder();

const prefixFor = (index: number) => `debug-skip-${index}`;
const runScript = (args: { body: string; payload: Record<string, unknown> }) =>
  new Function(args.body)()({ ...args.payload });

const dumpScreenshot = async (page: DebugPage, dir: string, prefix: string, timeout: number) => {
  const buffer = await page.screenshot({ fullPage: false, timeout });
  return writeBinaryFile(dir, `${prefix}.png`, buffer);
};

const dumpHtml = async (page: DebugPage, dir: string, prefix: string) => {
  const html = await page.content();
  return writeBinaryFile(dir, `${prefix}.html`, encoder.encode(html));
};

const dumpDom = async (
  page: DebugPage,
  dir: string,
  prefix: string,
  index: number,
  data: CommentRecord,
) => {
  const rows = await page.evaluate(runScript, {
    body: DEBUG_DOM_SCRIPT,
    payload: {},
  });
  return writeJsonFile(dir, `${prefix}.json`, {
    candidate: data,
    index,
    rows,
    url: page.url?.() ?? null,
  });
};

export const dumpCommentDebugArtifacts = async (
  page: DebugPage,
  dir: string,
  index: number,
  data: CommentRecord,
  timeout: number,
) => {
  const prefix = prefixFor(index);
  await Promise.allSettled([
    dumpScreenshot(page, dir, prefix, timeout),
    dumpHtml(page, dir, prefix),
    dumpDom(page, dir, prefix, index, data),
  ]);
};
