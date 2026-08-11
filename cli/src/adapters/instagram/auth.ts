import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AuthPage } from '../../schemas/index.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const COOKIE_BANNER_SCRIPT = readFileSync(join(dir, 'browser-scripts/cookie-banner.script'), 'utf8');
const DISMISS_LOGIN_WALL_SCRIPT = readFileSync(join(dir, 'browser-scripts/dismiss-login-wall.script'), 'utf8');

const runEvaluate = (
  page: { evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T> },
  body: string,
) => page.evaluate((args: { body: string }) => new Function(`return (${args.body});`)()(), { body });

export const handleCookieBanner = async (page: AuthPage) => {
  await runEvaluate(page, COOKIE_BANNER_SCRIPT);
  await page.waitForTimeout(750);
};

export const dismissLoginWall = async (page: AuthPage) => {
  await runEvaluate(page, DISMISS_LOGIN_WALL_SCRIPT);
  await page.waitForTimeout(250);
};

export const isLoginRequired = async (page: AuthPage) =>
  (await page.locator('input[name="username"], input[name="password"]').count()) > 0;

export const prepareAuthPage = async (page: AuthPage) => {
  await handleCookieBanner(page);
  await dismissLoginWall(page);
};
