import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import type { BrowserClosePort, RuntimeContext } from '../../schemas/index.ts';

const hasStorageState = (path: string) => existsSync(path);

const buildContextOptions = (context: RuntimeContext) =>
  hasStorageState(context.browserProfile.storageStatePath)
    ? { storageState: context.browserProfile.storageStatePath }
    : {};

export const openBrowserSession = async (
  context: RuntimeContext,
  headful: boolean,
) => {
  const browser = await chromium.launch({ headless: !headful });
  const browserContext = await browser.newContext(buildContextOptions(context));
  const page = await browserContext.newPage();
  return { browser, browserContext, page };
};

export const closeBrowserSession = async (browser: BrowserClosePort) => {
  await browser.close();
};
