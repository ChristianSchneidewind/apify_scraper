import { mkdir } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { chromium } from 'playwright';
import type { AuthLoginOptions, CliOutput, RuntimeContext } from '../../schemas/index.ts';
import { failResult } from '../../core/result.ts';

const ensureProfileDirectory = async (context: RuntimeContext) =>
  mkdir(context.browserProfile.dir, { recursive: true });

const openLoginPage = async (headful: boolean) => {
  const browser = await chromium.launch({ headless: !headful });
  const browserContext = await browser.newContext();
  const page = await browserContext.newPage();
  await page.goto(
    'https://www.instagram.com/accounts/login/',
    { waitUntil: 'domcontentloaded' },
  );
  return { browser, browserContext };
};

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
): Promise<CliOutput> => {
  if (options.noInput) {
    return failResult('auth.login', 'auth login requires interactive mode');
  }
  await ensureProfileDirectory(context);
  const session = await openLoginPage(options.headful);
  await waitForLoginConfirmation();
  await session.browserContext.storageState({
    path: context.browserProfile.storageStatePath,
  });
  await session.browser.close();
  return buildSuccess(context);
};
