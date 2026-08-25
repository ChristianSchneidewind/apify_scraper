import type { ElementHandle, VisualPage } from '../../schemas/index.ts';
import {
  fitCommentViewport,
  forceLightMode,
  freezeAnimatedMedia,
  hideVisualOverlays,
} from './visual-browser.ts';

const rejectAfter = <T>(ms: number, message: string) =>
  new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms));

const withTimeout = <T>(promise: Promise<T>, ms: number, message: string) =>
  Promise.race([promise, rejectAfter<T>(ms, message)]);

const runVisualStep = (page: VisualPage, step: () => void) =>
  withTimeout(page.evaluate(step, undefined), 3000, 'visual step timeout')
    .catch(() => undefined);

const prepareVisuals = async (page: VisualPage) => {
  await runVisualStep(page, forceLightMode);
  await runVisualStep(page, hideVisualOverlays);
  await runVisualStep(page, freezeAnimatedMedia);
  await page.waitForTimeout(250);
};

export const prepareProfileScreenshotVisuals = async (page: VisualPage) => {
  await prepareVisuals(page);
};

export const prepareCommentScreenshotVisuals = async (
  page: VisualPage,
  handle: ElementHandle,
) => {
  await prepareVisuals(page);
  const fit = handle.evaluate(fitCommentViewport, undefined);
  await withTimeout(fit, 3000, 'visual step timeout').catch(() => undefined);
  await page.waitForTimeout(250);
};
