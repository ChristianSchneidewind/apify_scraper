import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/adapters/playwright/browser.ts', () => ({
  closeBrowserSession: vi.fn(),
  openBrowserSession: vi.fn(),
}));
vi.mock('../src/adapters/filesystem/output.ts', () => ({
  ensureOutputDirectory: vi.fn(),
  writeBinaryFile: vi.fn(),
  writeJsonFile: vi.fn(),
}));

import {
  ensureOutputDirectory,
  writeBinaryFile,
  writeJsonFile,
} from '../src/adapters/filesystem/output.ts';
import { openBrowserSession } from '../src/adapters/playwright/browser.ts';
import { runScrapeProfiles } from '../src/modules/scrape-profiles/run.ts';

const context = {
  browserProfile: {
    dir: '/tmp/profile',
    name: 'default',
    storageStatePath: '/tmp/profile/storage-state.json',
  },
  cwd: '/tmp/project',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runScrapeProfiles', () => {
  it('writes profile json and screenshot', async () => {
    const goto = vi.fn();
    const waitForTimeout = vi.fn();
    const evaluate = vi.fn().mockResolvedValue({
      avatarUrl: null,
      biography: '',
      description: '',
      fullName: 'Profile',
      stats: [],
      title: 'Profile',
      url: 'https://www.instagram.com/nasa/',
      username: 'nasa',
    });
    const screenshot = vi.fn().mockResolvedValue(new Uint8Array([1, 2]));
    vi.mocked(openBrowserSession).mockResolvedValue({
      browser: { close: vi.fn() },
      browserContext: {},
      page: { evaluate, goto, screenshot, waitForTimeout },
    } as never);
    vi.mocked(ensureOutputDirectory).mockResolvedValue('/tmp/out');
    vi.mocked(writeJsonFile).mockResolvedValue('/tmp/out/nasa.json');
    vi.mocked(writeBinaryFile).mockResolvedValue('/tmp/out/nasa.png');

    const result = await runScrapeProfiles(context, {
      browserProfile: 'default',
      cwd: '/tmp/project',
      dryRun: false,
      headful: true,
      json: true,
      noColor: false,
      noInput: false,
      outDir: 'profiles',
      plain: false,
      profileSlug: 'nasa',
      quiet: false,
      url: 'https://www.instagram.com/nasa/',
      verbose: false,
    });

    expect(result.ok).toBe(true);
    expect(result.details.jsonPath).toBe('/tmp/out/nasa.json');
    expect(result.details.screenshotPath).toBe('/tmp/out/nasa.png');
  });
});
