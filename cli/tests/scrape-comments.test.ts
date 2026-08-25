import { writeFile } from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/adapters/cdp/browser.ts', () => ({
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
import { closeBrowserSession, openBrowserSession } from '../src/adapters/cdp/browser.ts';
import { runCommentScrapeLoop } from '../src/modules/scrape-comments/scrape-loop.ts';
import { runScrapeComments } from '../src/modules/scrape-comments/run.ts';

const context = {
  cdp: { url: 'http://127.0.0.1:9222' },
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
      cdpUrl: 'http://127.0.0.1:9222',
      cwd: '/tmp/project',
      dryRun: false,
  evidence: false,
      headful: true,
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
    expect(result.details.incompleteLikersCount).toBe('0');
    expect(result.details.multipartCount).toBe('0');
    expect(Number(result.details.durationMs)).toBeGreaterThanOrEqual(0);
    expect(result.details.commentsPerSecond).toBeDefined();
    expect(result.details.avgCommentMs).toBeDefined();
    expect(runCommentScrapeLoop).toHaveBeenCalled();
    expect(openBrowserSession).toHaveBeenCalledWith(context);
    expect(closeBrowserSession).toHaveBeenCalled();
    expect(writeJsonFile).toHaveBeenCalled();
    expect(evaluate).toHaveBeenCalled();
    expect(waitForTimeout).toHaveBeenCalled();
  });

  it('loads comments from a resume checkpoint', async () => {
    const checkpoint = '/tmp/instagram-resume-checkpoint.json';
    const initialComment = {
      commentPermalink: '/p/abc/c/1', datetime: null, text: 'saved',
      timeText: '1h', username: 'saved_user', userProfilePath: '/saved_user/',
    };
    await writeFile(checkpoint, JSON.stringify({ comments: [initialComment] }));
    vi.mocked(openBrowserSession).mockResolvedValue({
      browser: { close: vi.fn() }, browserContext: {},
      page: { evaluate: vi.fn().mockResolvedValue(undefined), goto: vi.fn(), locator: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(0), elementHandles: vi.fn().mockResolvedValue([]), click: vi.fn() }), waitForTimeout: vi.fn() },
    } as never);
    vi.mocked(ensureOutputDirectory).mockResolvedValue('/tmp/out');
    vi.mocked(runCommentScrapeLoop).mockResolvedValue([]);

    await runScrapeComments(context, {
      cdpUrl: 'http://127.0.0.1:9222', cwd: '/tmp/project', dryRun: false,
  evidence: false,
      headful: true, json: false, noColor: false, noInput: false,
      outDir: 'comments', plain: false, quiet: true,
      resume: checkpoint, url: 'https://www.instagram.com/p/abc/', verbose: false,
    });

    expect(runCommentScrapeLoop).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      initialComments: [initialComment],
    }));
  });

  it('closes the browser when navigation fails', async () => {
    const close = vi.fn();
    vi.mocked(openBrowserSession).mockResolvedValue({
      browser: { close },
      browserContext: {},
      page: { goto: vi.fn().mockRejectedValue(new Error('navigation failed')) },
    } as never);
    vi.mocked(ensureOutputDirectory).mockResolvedValue('/tmp/out');

    await expect(runScrapeComments(context, {
      cdpUrl: 'http://127.0.0.1:9222', cwd: '/tmp/project', dryRun: false,
  evidence: false,
      headful: true, json: false, noColor: false, noInput: false,
      outDir: 'comments', plain: false, quiet: true,
      url: 'https://www.instagram.com/p/abc/', verbose: false,
    })).rejects.toThrow('navigation failed');
    expect(closeBrowserSession).toHaveBeenCalledWith({ close });
  });
});
