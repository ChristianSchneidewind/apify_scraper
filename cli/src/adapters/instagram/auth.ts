import type { AuthPage } from '../../schemas/index.ts';
import {
  acceptCookieBanner,
  dismissLoginWallBrowser,
} from './auth-browser.ts';

export const handleCookieBanner = async (page: AuthPage) => {
  await page.evaluate(acceptCookieBanner, undefined);
  await page.waitForTimeout(750);
};

export const dismissLoginWall = async (page: AuthPage) => {
  await page.evaluate(dismissLoginWallBrowser, undefined);
  await page.waitForTimeout(250);
};

export const isLoginRequired = async (page: AuthPage) =>
  (await page.locator('input[name="username"], input[name="password"]').count()) > 0;

export const prepareAuthPage = async (page: AuthPage) => {
  await handleCookieBanner(page);
  await dismissLoginWall(page);
};
