import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/adapters/playwright/browser.ts', () => ({
  closeBrowserSession: vi.fn(),
  openBrowserSession: vi.fn(),
}));
vi.mock('../src/adapters/filesystem/output.ts', () => ({
  ensureOutputDirectory: vi.fn(),
  writeJsonFile: vi.fn(),
}));
vi.mock('../src/modules/scrape-comments/scrape-loop.ts', () => ({
  runCommentScrapeLoop: vi.fn(),
}));

import { ensureOutputDirectory, writeJsonFile } from '../src/adapters/filesystem/output.ts';
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
    const evaluate = vi.fn().mockResolvedValue(undefined);
    const waitForTimeout = vi.fn();
    const locator = vi.fn().mockReturnValue({
      click: vi.fn().mockResolvedValue(undefined),
      count: vi.fn().mockResolvedValue(0),
      elementHandles: vi.fn().mockResolvedValue([]),
    });
    vi.mocked(openBrowserSession).mockResolvedValue({
      browser: { close: vi.fn() },
      browserContext: {},
      page: { evaluate, goto, locator, waitForTimeout },
    } as never);
    vi.mocked(runCommentScrapeLoop).mockResolvedValue([
      {
        commentLikers: [{ profileUrl: 'https://www.instagram.com/user_a/', username: 'user_a' }],
        commentPermalink: '/p/abc/c/1',
        datetime: null,
        likesCount: 2,
        screenshotPaths: ['/tmp/out/uuid.png'],
        text: 'hello',
        timeText: '1h',
        username: 'user_a',
        userProfilePath: '/user_a/',
      },
    ]);
    vi.mocked(ensureOutputDirectory).mockResolvedValue('/tmp/out');
    vi.mocked(writeJsonFile).mockResolvedValue('/tmp/out/comments.json');

    const result = await runScrapeComments(context, {
      browserProfile: 'default',
      cwd: '/tmp/project',
      dryRun: false,
      json: false,
      maxCommentLikers: 50,
      noColor: false,
      noInput: false,
      outDir: 'comments',
      plain: false,
      quiet: false,
      url: 'https://www.instagram.com/p/abc/',
      verbose: false,
    });

    expect(result.ok).toBe(true);
    expect(result.details.commentsCount).toBe('1');
    expect(result.details.likesCount).toBe('2');
    expect(result.details.likersCount).toBe('1');
    expect(result.details.screenshotCount).toBe('1');
    expect(runCommentScrapeLoop).toHaveBeenCalled();
    expect(writeJsonFile).toHaveBeenCalled();
    expect(evaluate).toHaveBeenCalled();
    expect(waitForTimeout).toHaveBeenCalled();
  });
});
