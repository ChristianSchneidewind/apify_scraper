import { mkdir } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({ mkdir: vi.fn() }));
vi.mock('node:readline/promises', () => ({ createInterface: vi.fn() }));
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

import { chromium } from 'playwright';
import { runAuthLogin } from '../src/modules/auth/login.ts';

const context = {
  browserProfile: {
    dir: '/tmp/profile',
    name: 'work',
    storageStatePath: '/tmp/profile/storage-state.json',
  },
  cwd: '/tmp',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runAuthLogin', () => {
  it('saves storage state for the selected profile', async () => {
    const storageState = vi.fn();
    const close = vi.fn();
    const goto = vi.fn();
    const newPage = vi.fn().mockResolvedValue({ goto });
    const newContext = vi.fn().mockResolvedValue({ newPage, storageState });
    const launch = vi.fn().mockResolvedValue({ close, newContext });
    const question = vi.fn();
    const rlClose = vi.fn();

    vi.mocked(chromium.launch).mockImplementation(launch);
    vi.mocked(createInterface).mockReturnValue({ close: rlClose, question } as never);

    const result = await runAuthLogin(context, {
      browserProfile: 'work',
      cwd: '/tmp',
      dryRun: false,
      headful: true,
      json: false,
      noColor: false,
      noInput: false,
      quiet: false,
      verbose: false,
    });

    expect(result.ok).toBe(true);
    expect(mkdir).toHaveBeenCalledWith('/tmp/profile', { recursive: true });
    expect(storageState).toHaveBeenCalledWith({ path: '/tmp/profile/storage-state.json' });
  });

  it('fails in no-input mode', async () => {
    const result = await runAuthLogin(context, {
      browserProfile: 'work',
      cwd: '/tmp',
      dryRun: false,
      headful: true,
      json: false,
      noColor: false,
      noInput: true,
      quiet: false,
      verbose: false,
    });

    expect(result.ok).toBe(false);
  });
});
