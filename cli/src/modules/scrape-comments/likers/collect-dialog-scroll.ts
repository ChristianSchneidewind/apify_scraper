import {
  NUDGE_END_SCRIPT,
  OSCILLATE_END_SCRIPT,
  RESET_DIALOG_SCRIPT,
  SCROLL_END_SCRIPT,
  runIifeBody,
} from './collect-dialog-utils.ts';

export const resetLikersDialogScroll = async (page: {
  evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
  waitForTimeout: (ms: number) => Promise<void>;
}) => {
  await page.evaluate(runIifeBody<boolean>, { body: RESET_DIALOG_SCRIPT });
  await page.waitForTimeout(120);
};

export const scrollLikersDialogToEnd = async (page: {
  evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
  waitForTimeout: (ms: number) => Promise<void>;
}) => {
  await page.evaluate(runIifeBody<boolean>, { body: SCROLL_END_SCRIPT });
  await page.waitForTimeout(180);
};

export const nudgeLikersDialogAtEnd = async (page: {
  evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
  waitForTimeout: (ms: number) => Promise<void>;
}) => {
  await page.evaluate(runIifeBody<boolean>, { body: NUDGE_END_SCRIPT });
  await page.waitForTimeout(220);
};

export const oscillateLikersDialogAtEnd = async (page: {
  evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
  waitForTimeout: (ms: number) => Promise<void>;
}) => {
  await page.evaluate(runIifeBody<boolean>, { body: OSCILLATE_END_SCRIPT });
  await page.waitForTimeout(280);
};
