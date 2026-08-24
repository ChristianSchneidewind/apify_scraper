import type { LikersDialogPage } from '../../../schemas/index.ts';
import {
  nudgeLikersDialogEnd,
  oscillateLikersDialogEnd,
  resetLikersDialog,
  scrollLikersDialogEnd,
} from './browser.ts';

export const resetLikersDialogScroll = async (page: LikersDialogPage) => {
  await page.evaluate(resetLikersDialog, undefined);
  await page.waitForTimeout(120);
};

export const scrollLikersDialogToEnd = async (page: LikersDialogPage) => {
  await page.evaluate(scrollLikersDialogEnd, undefined);
  await page.waitForTimeout(180);
};

export const nudgeLikersDialogAtEnd = async (page: LikersDialogPage) => {
  await page.evaluate(nudgeLikersDialogEnd, undefined);
  await page.waitForTimeout(220);
};

export const oscillateLikersDialogAtEnd = async (page: LikersDialogPage) => {
  await page.evaluate(oscillateLikersDialogEnd, undefined);
  await page.waitForTimeout(280);
};
