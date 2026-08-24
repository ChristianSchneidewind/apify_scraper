import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import type { AuthLoginOptions, AuthPage, CliOutput, PromptInput, RuntimeContext } from '../../schemas/index.ts';
import { prepareAuthPage } from '../../adapters/instagram/auth.ts';
import { closeBrowserSession, openBrowserSession } from '../../adapters/cdp/browser.ts';
import { failResult } from '../../core/result.ts';

const INSTAGRAM_HOME = 'https://www.instagram.com/';
const INSTAGRAM_LOGIN = 'https://www.instagram.com/accounts/login/';

// Logins are never automated: the human signs in once in their real Chrome
// profile, and the session persists there. This command only verifies state.
const isLoggedIn = async (page: AuthPage) =>
  (await page.locator('nav, svg[aria-label="Home"], svg[aria-label="Profile"]').count()) > 0;

export const canPromptLogin = (input: PromptInput) => Boolean(input?.isTTY);

const waitForLoginConfirmation = async () => {
  const rl = createInterface({ input: stdin, output: stdout });
  await rl.question('Complete Instagram login in the browser, then press Enter. ');
  await rl.close();
};

const buildSuccess = (context: RuntimeContext): CliOutput => ({
  command: 'auth.login',
  details: { cdpUrl: context.cdp.url },
  ok: true,
  summary: 'instagram session active in the connected Chrome profile',
});

const verifyLogin = async (page: AuthPage) => {
  await prepareAuthPage(page);
  return isLoggedIn(page);
};

export const runAuthLogin = async (
  context: RuntimeContext,
  options: AuthLoginOptions,
  input = stdin,
): Promise<CliOutput> => {
  const session = await openBrowserSession(context);
  try {
    await session.page.goto(INSTAGRAM_HOME, { waitUntil: 'domcontentloaded' });
    if (await verifyLogin(session.page)) return buildSuccess(context);
    if (options.noInput || !canPromptLogin(input)) return failResult('auth.login', 'not logged in; sign in manually in the connected Chrome');
    await session.page.goto(INSTAGRAM_LOGIN, { waitUntil: 'domcontentloaded' });
    await prepareAuthPage(session.page);
    await waitForLoginConfirmation();
    await session.page.waitForTimeout(1000);
    if (await verifyLogin(session.page)) return buildSuccess(context);
    return failResult('auth.login', 'Instagram login was not completed');
  } finally {
    await closeBrowserSession(session.browser);
  }
};
