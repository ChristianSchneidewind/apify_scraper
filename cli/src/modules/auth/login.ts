import { mkdir } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import type { AuthLoginOptions, AuthPage, CliOutput, RuntimeContext } from '../../schemas/index.ts';
import { prepareAuthPage } from '../../adapters/instagram/auth.ts';
import { closeBrowserSession, openBrowserSession } from '../../adapters/playwright/browser.ts';
import { failResult } from '../../core/result.ts';

const ensureProfileDirectory = async (context: RuntimeContext) =>
  mkdir(context.browserProfile.dir, { recursive: true });

const openLoginPage = async (context: RuntimeContext, headful: boolean) => {
  const session = await openBrowserSession(context, headful);
  return { ...session, page: session.page as AuthPage };
};

const isLoggedIn = async (page: AuthPage) =>
  (await page.locator('nav, svg[aria-label="Home"], svg[aria-label="Profile"]').count()) > 0;

export const canPromptLogin = (input: { isTTY?: boolean } | null | undefined) => Boolean(input?.isTTY);

const waitForLoginConfirmation = async () => {
  const rl = createInterface({ input: stdin, output: stdout });
  await rl.question('Complete Instagram login in the browser, then press Enter. ');
  await rl.close();
};

const buildSuccess = (
  context: RuntimeContext,
): CliOutput => ({
  command: 'auth.login',
  details: {
    browserProfile: context.browserProfile.name,
    storageStatePath: context.browserProfile.storageStatePath,
  },
  ok: true,
  summary: `auth login saved for profile ${context.browserProfile.name}`,
});

export const runAuthLogin = async (
  context: RuntimeContext,
  options: AuthLoginOptions,
  input = stdin,
): Promise<CliOutput> => {
  await ensureProfileDirectory(context);
  const session = await openLoginPage(context, options.headful);
  await session.page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
  await prepareAuthPage(session.page);
  if (await isLoggedIn(session.page)) {
    await session.browserContext.storageState({ path: context.browserProfile.storageStatePath });
    await closeBrowserSession(session.browser);
    return buildSuccess(context);
  }
  if (options.noInput || !canPromptLogin(input)) {
    await closeBrowserSession(session.browser);
    return failResult('auth.login', 'auth login requires an interactive terminal');
  }
  await session.page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded' });
  await prepareAuthPage(session.page);
  await waitForLoginConfirmation();
  await session.browserContext.storageState({ path: context.browserProfile.storageStatePath });
  await closeBrowserSession(session.browser);
  return buildSuccess(context);
};
