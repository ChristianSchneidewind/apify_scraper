import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandCommentForCapture } from '../../modules/scrape-comments/multipart/planner.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const FORCE_LIGHT_MODE_SCRIPT = readFileSync(join(dir, 'browser-scripts/force-light-mode.script'), 'utf8');
const HIDE_VISUAL_OVERLAYS_SCRIPT = readFileSync(join(dir, 'browser-scripts/hide-visual-overlays.script'), 'utf8');
const FREEZE_ANIMATED_MEDIA_SCRIPT = readFileSync(join(dir, 'browser-scripts/freeze-animated-media.script'), 'utf8');
const FIT_COMMENT_VIEWPORT_SCRIPT = readFileSync(join(dir, 'browser-scripts/fit-comment-viewport.script'), 'utf8');

const rejectAfter = <T>(ms: number, message: string) =>
  new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms));

const withTimeout = <T>(promise: Promise<T>, ms: number, message: string) =>
  Promise.race([promise, rejectAfter<T>(ms, message)]);

const runPageScript = (
  page: { evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T> },
  body: string,
) => page.evaluate((args: { body: string }) => new Function(`return (${args.body});`)()(), { body });

const runHandleScript = (
  handle: { evaluate: <T, A>(fn: (el: Element, args: A) => T, args: A) => Promise<T> },
  body: string,
) => handle.evaluate((el: Element, args: { body: string }) => new Function(args.body)()({ el }), { body });

const wait = (page: { waitForTimeout: (ms: number) => Promise<void> }, ms: number) => page.waitForTimeout(ms);

const prepareVisuals = async (
  page: { evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>; waitForTimeout: (ms: number) => Promise<void> },
) => {
  await withTimeout(runPageScript(page, FORCE_LIGHT_MODE_SCRIPT), 3000, 'visual step timeout').catch(() => undefined);
  await withTimeout(runPageScript(page, HIDE_VISUAL_OVERLAYS_SCRIPT), 3000, 'visual step timeout').catch(() => undefined);
  await withTimeout(runPageScript(page, FREEZE_ANIMATED_MEDIA_SCRIPT), 3000, 'visual step timeout').catch(() => undefined);
  await wait(page, 250);
};

export const prepareProfileScreenshotVisuals = async (
  page: { evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>; waitForTimeout: (ms: number) => Promise<void> },
) => {
  await prepareVisuals(page);
};

export const prepareCommentScreenshotVisuals = async (
  page: { evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>; waitForTimeout: (ms: number) => Promise<void> },
  handle: { evaluate: <T, A>(fn: (el: Element, args: A) => T, args: A) => Promise<T> },
) => {
  await prepareVisuals(page);
  await withTimeout(runHandleScript(handle, FIT_COMMENT_VIEWPORT_SCRIPT), 3000, 'visual step timeout').catch(() => undefined);
  await wait(page, 250);
};
