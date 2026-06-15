import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  launch: vi.fn(),
}));

vi.mock('playwright', () => ({
  chromium: { launch: mocks.launch },
}));
vi.mock('node:fs', () => ({ existsSync: mocks.existsSync }));

import { closeBrowserSession, openBrowserSession } from '../src/adapters/playwright/browser.ts';

const context = {
  browserProfile: {
    dir: '/tmp/profile',
    name: 'default',
    storageStatePath: '/tmp/profile/storage-state.json',
  },
  cwd: '/tmp/project',
};

describe('browser adapter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('opens a session with storage state when present', async () => {
    const page = {};
    const newPage = vi.fn().mockResolvedValue(page);
    const browserContext = { newPage };
    const newContext = vi.fn().mockResolvedValue(browserContext);
    const browser = { newContext, close: vi.fn() };
    mocks.existsSync.mockReturnValue(true);
    mocks.launch.mockResolvedValue(browser);

    const result = await openBrowserSession(context as never, true);

    expect(mocks.launch).toHaveBeenCalledWith({ headless: false });
    expect(newContext).toHaveBeenCalledWith({
      storageState: '/tmp/profile/storage-state.json',
    });
    expect(result.page).toBe(page);
  });

  it('opens a session without storage state when absent', async () => {
    const browserContext = { newPage: vi.fn().mockResolvedValue({}) };
    const browser = {
      newContext: vi.fn().mockResolvedValue(browserContext),
      close: vi.fn(),
    };
    mocks.existsSync.mockReturnValue(false);
    mocks.launch.mockResolvedValue(browser);

    await openBrowserSession(context as never, false);

    expect(mocks.launch).toHaveBeenCalledWith({ headless: true });
    expect(browser.newContext).toHaveBeenCalledWith({});
  });

  it('closes the browser session', async () => {
    const browser = { close: vi.fn().mockResolvedValue(undefined) };
    await closeBrowserSession(browser);
    expect(browser.close).toHaveBeenCalled();
  });
});
