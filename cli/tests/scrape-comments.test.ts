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
vi.mock('../src/modules/scrape-comments/scrape-loop.ts', () => ({
  runCommentScrapeLoop: vi.fn(),
}));

import {
  ensureOutputDirectory,
  writeBinaryFile,
  writeJsonFile,
} from '../src/adapters/filesystem/output.ts';
import { openBrowserSession } from '../src/adapters/playwright/browser.ts';
import { runCommentScrapeLoop } from '../src/modules/scrape-comments/scrape-loop.ts';
import { runScrapeComments } from '../src/modules/scrape-comments/run.ts';

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

describe('runScrapeComments', () => {
  it('writes extracted comments to json', async () => {
    const goto = vi.fn();
    const screenshot = vi.fn().mockResolvedValue(new Uint8Array([1, 2]));
    const waitForTimeout = vi.fn();
    vi.mocked(openBrowserSession).mockResolvedValue({
      browser: { close: vi.fn() },
      browserContext: {},
      page: { goto, screenshot, waitForTimeout },
    } as never);
    vi.mocked(runCommentScrapeLoop).mockResolvedValue([
      {
        commentPermalink: '/p/abc/c/1',
        datetime: null,
        text: 'hello',
        timeText: '1h',
        username: 'user_a',
        userProfilePath: '/user_a/',
      },
      {
        commentPermalink: '/p/abc/c/2',
        datetime: null,
        text: 'world',
        timeText: '2h',
        username: 'user_b',
        userProfilePath: '/user_b/',
      },
    ]);
    vi.mocked(ensureOutputDirectory).mockResolvedValue('/tmp/out');
    vi.mocked(writeJsonFile).mockResolvedValue('/tmp/out/comments.json');
    vi.mocked(writeBinaryFile).mockResolvedValue('/tmp/out/comments.png');

    const result = await runScrapeComments(context, {
      browserProfile: 'default',
      cwd: '/tmp/project',
      dryRun: false,
      headful: false,
      json: false,
      noColor: false,
      noInput: false,
      outDir: 'comments',
      quiet: false,
      url: 'https://www.instagram.com/p/abc/',
      verbose: false,
    });

    expect(result.ok).toBe(true);
    expect(result.details.commentsCount).toBe('2');
    expect(runCommentScrapeLoop).toHaveBeenCalled();
    expect(writeJsonFile).toHaveBeenCalled();
  });
});
