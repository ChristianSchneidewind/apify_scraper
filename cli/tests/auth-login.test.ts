import { createInterface } from 'node:readline/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  closeBrowserSession: vi.fn(),
  openBrowserSession: vi.fn(),
}));

vi.mock('node:readline/promises', () => ({ createInterface: vi.fn() }));
vi.mock('../src/adapters/cdp/browser.ts', () => ({
  closeBrowserSession: mocks.closeBrowserSession,
  openBrowserSession: mocks.openBrowserSession,
}));

import { canPromptLogin, runAuthLogin } from '../src/modules/auth/login.ts';

const context = {
  cdp: { url: 'http://127.0.0.1:9222' },
  cwd: '/tmp',
};

const options = {
  cdpUrl: 'http://127.0.0.1:9222',
  cwd: '/tmp',
  dryRun: false,
  headful: true,
  json: false,
  noColor: false,
  noInput: false,
  plain: false,
  quiet: false,
  verbose: false,
};

const buildPage = (count: ReturnType<typeof vi.fn>) => ({
  evaluate: vi.fn().mockResolvedValue(undefined),
  goto: vi.fn().mockResolvedValue(undefined),
  locator: vi.fn().mockReturnValue({ count }),
  waitForTimeout: vi.fn().mockResolvedValue(undefined),
});

const mockSession = (page: unknown) => {
  mocks.openBrowserSession.mockResolvedValue({
    browser: { close: vi.fn() },
    browserContext: { newPage: vi.fn() },
    page,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runAuthLogin', () => {
  it('confirms an active session after a manual login', async () => {
    const count = vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    const page = buildPage(count);
    const question = vi.fn();
    const rlClose = vi.fn();
    mockSession(page);
    vi.mocked(createInterface).mockReturnValue({ close: rlClose, question } as never);

    const result = await runAuthLogin(context, options, { isTTY: true } as never);

    expect(result.ok).toBe(true);
    expect(result.details?.cdpUrl).toBe('http://127.0.0.1:9222');
    expect(page.evaluate).toHaveBeenCalled();
    expect(question).toHaveBeenCalledOnce();
    expect(mocks.closeBrowserSession).toHaveBeenCalled();
  });

  it('skips the prompt when already logged in', async () => {
    const count = vi.fn().mockResolvedValue(1);
    const page = buildPage(count);
    const question = vi.fn();
    mockSession(page);
    vi.mocked(createInterface).mockReturnValue({ close: vi.fn(), question } as never);

    const result = await runAuthLogin(context, options);

    expect(result.ok).toBe(true);
    expect(page.evaluate).toHaveBeenCalled();
    expect(question).not.toHaveBeenCalled();
  });

  it('fails in no-input mode when logged out', async () => {
    const count = vi.fn().mockResolvedValue(0);
    const page = buildPage(count);
    mockSession(page);

    const result = await runAuthLogin(
      context,
      { ...options, noInput: true },
      { isTTY: true } as never,
    );

    expect(result.ok).toBe(false);
    expect(result.summary).toContain('not logged in');
  });

  it('fails when the login was not completed', async () => {
    const count = vi.fn().mockResolvedValue(0);
    const page = buildPage(count);
    mockSession(page);
    vi.mocked(createInterface).mockReturnValue({
      close: vi.fn(),
      question: vi.fn(),
    } as never);

    const result = await runAuthLogin(context, options, { isTTY: true } as never);

    expect(result.ok).toBe(false);
    expect(result.summary).toContain('not completed');
  });

  it('detects interactive terminals', () => {
    expect(canPromptLogin({ isTTY: true })).toBe(true);
    expect(canPromptLogin({ isTTY: false })).toBe(false);
  });
});
