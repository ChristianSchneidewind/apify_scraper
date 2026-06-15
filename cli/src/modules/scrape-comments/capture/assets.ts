import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeBinaryFile, writeJsonFile } from '../../../adapters/filesystem/output.ts';
import type { CapturePage, CommentRecord, ElementHandle } from '../../../schemas/index.ts';
import { buildCommentMetadataPayload } from './payloads.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const VERIFY_SCRIPT = readFileSync(join(dir, '../multipart/browser-scripts/multipart-verify.script'), 'utf8');
const PLACEHOLDER_PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAQAAAC0lEQVR42mP8/x8AAwMCAO7q8JcAAAAASUVORK5CYII=', 'base64'));
const QUICK_HIGHLIGHT_STYLE = ':scope { outline: 4px solid red !important; outline-offset: -4px !important; box-shadow: inset 0 0 0 4px red !important; }';

export const hashBuffer = (buffer: Uint8Array) => createHash('sha256').update(buffer).digest('hex');

const withTimeout = async <T>(promise: Promise<T>, ms: number) => {
  const timeout = new Promise<T>((_, reject) => setTimeout(() => reject(new Error('capture timeout')), ms));
  return Promise.race([promise, timeout]);
};

const runPayloadOnElement = <T>(el: Element, args: { body: string; payload: Record<string, unknown> }) =>
  (new Function(args.body)() as (payload: Record<string, unknown>) => T)({ ...args.payload, el });

export const savePart = async (
  outDir: string,
  session: {
    screenshotKeys: string[];
    screenshotPaths: string[];
    screenshotUtc: string;
    screenshotUuid: string;
  },
  key: string,
  buffer: Uint8Array,
) => {
  const path = await writeBinaryFile(outDir, key, buffer);
  session.screenshotKeys.push(key);
  session.screenshotPaths.push(path);
};

export const takeScreenshot = async (page: CapturePage, clip?: Record<string, number>) => {
  if (!clip) return page.screenshot({ animations: 'disabled', caret: 'hide', fullPage: false, timeout: 30000 });
  const box = { height: clip.height ?? 1, width: clip.width ?? 1, x: clip.x ?? 0, y: clip.y ?? 0 };
  return page.screenshot({ animations: 'disabled', caret: 'hide', clip: box, fullPage: false, timeout: 30000 });
};

export const writeMetadata = async (
  page: CapturePage,
  outDir: string,
  data: CommentRecord,
  commentIndex: number,
  session: {
    screenshotKeys: string[];
    screenshotPaths: string[];
    screenshotUtc: string;
    screenshotUuid: string;
  },
) => {
  const firstKey = session.screenshotKeys[0];
  if (!firstKey) return null;
  const metadataPayload = buildCommentMetadataPayload(data, commentIndex, page.url(), session.screenshotUuid, session.screenshotUtc, session.screenshotKeys);
  const metadataName = `${firstKey.replace(/\.png$/, '')}.json`;
  return writeJsonFile(outDir, metadataName, metadataPayload);
};

const captureQuickScreenshot = async (
  page: CapturePage,
  handle: ElementHandle,
  data: CommentRecord,
  outDir: string,
  session: {
    screenshotKeys: string[];
    screenshotPaths: string[];
    screenshotUtc: string;
    screenshotUuid: string;
  },
  commentIndex: number,
  lastHash: string | null,
) => {
  const buffer = await withTimeout(
    (handle.screenshot ? handle.screenshot({ animations: 'disabled', caret: 'hide', style: QUICK_HIGHLIGHT_STYLE, timeout: 5000 }).catch(() => page.screenshot({ animations: 'disabled', caret: 'hide', fullPage: false, timeout: 5000 })) : page.screenshot({ animations: 'disabled', caret: 'hide', fullPage: false, timeout: 5000 })),
    5500,
  ).catch(() => PLACEHOLDER_PNG);
  const currentHash = hashBuffer(buffer);
  if (currentHash === lastHash) return { lastScreenshotHash: lastHash, metadataPath: null };
  await savePart(outDir, session, `${session.screenshotUuid}.png`, buffer);
  const metadataPath = await writeMetadata(page, outDir, data, commentIndex, session);
  return { lastScreenshotHash: currentHash, metadataPath };
};

export const capturePlaceholderCommentScreenshot = async (
  page: CapturePage,
  data: CommentRecord,
  outDir: string,
  session: {
    screenshotKeys: string[];
    screenshotPaths: string[];
    screenshotUtc: string;
    screenshotUuid: string;
  },
  commentIndex: number,
  lastHash: string | null,
) => {
  const buffer = PLACEHOLDER_PNG;
  const currentHash = hashBuffer(buffer);
  if (currentHash === lastHash) return { lastScreenshotHash: lastHash, metadataPath: null, screenshotKeys: session.screenshotKeys, screenshotPaths: session.screenshotPaths };
  await savePart(outDir, session, `${session.screenshotUuid}.png`, buffer);
  const metadataPath = await writeMetadata(page, outDir, data, commentIndex, session);
  return { lastScreenshotHash: currentHash, metadataPath, screenshotKeys: session.screenshotKeys, screenshotPaths: session.screenshotPaths };
};

export const captureQuickCommentScreenshot = captureQuickScreenshot;
export { PLACEHOLDER_PNG, VERIFY_SCRIPT, runPayloadOnElement };
