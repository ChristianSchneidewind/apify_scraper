import { access } from 'node:fs/promises';
import { chromium } from 'playwright';
import type { RuntimeContext } from '../../schemas/index.ts';

const hasStorageState = async (path: string) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const buildContextOptions = async (context: RuntimeContext) => {
  const hasState = await hasStorageState(context.browserProfile.storageStatePath);
  return hasState
    ? { storageState: context.browserProfile.storageStatePath }
    : {};
};

export const openBrowserSession = async (
  context: RuntimeContext,
  headful: boolean,
) => {
  const browser = await chromium.launch({ headless: !headful });
  const browserContext = await browser.newContext(
    await buildContextOptions(context),
  );
  const page = await browserContext.newPage();
  return { browser, browserContext, page };
};

export const closeBrowserSession = async (browser: { close: () => Promise<void> }) => {
  await browser.close();
};
