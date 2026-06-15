import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/adapters/instagram/highlight.ts', () => ({
  ensureHighlightReady: vi.fn(),
}));
vi.mock('../src/adapters/instagram/load-script.ts', () => ({
  browserRunPayload: vi.fn(),
}));
vi.mock('../src/adapters/filesystem/output.ts', () => ({
  writeBinaryFile: vi.fn(),
  writeJsonFile: vi.fn(),
}));
vi.mock('../src/modules/scrape-comments/multipart/planner.ts', () => ({
  expandCommentForCapture: vi.fn().mockResolvedValue(undefined),
  planCommentMultipart: vi.fn(),
}));

import { ensureHighlightReady } from '../src/adapters/instagram/highlight.ts';
import { writeBinaryFile, writeJsonFile } from '../src/adapters/filesystem/output.ts';
import { captureCommentAssets } from '../src/modules/scrape-comments/capture/capture.ts';
import { planCommentMultipart } from '../src/modules/scrape-comments/multipart/planner.ts';

const data = {
  commentLikers: [],
  commentPermalink: '/p/abc/c/1',
  datetime: null,
  text: 'hello',
  timeText: '1h',
  username: 'alice',
  userProfilePath: '/alice/',
};

const baseSession = () => ({
  screenshotKeys: [] as string[],
  screenshotPaths: [] as string[],
  screenshotUtc: '2026-06-08 12:00:00 UTC',
  screenshotUuid: 'uuid-1',
});

const buildPage = (...shots: number[][]) => ({
  evaluate: vi.fn().mockResolvedValue(undefined),
  screenshot: vi
    .fn()
    .mockImplementation(() => Promise.resolve(new Uint8Array(shots.shift() || [1, 2, 3]))),
  url: vi.fn().mockReturnValue('https://www.instagram.com/p/abc/'),
  waitForTimeout: vi.fn().mockResolvedValue(undefined),
});

const buildHandle = (...results: unknown[]) => ({
  evaluate: vi.fn().mockImplementation(() => Promise.resolve(results.shift())),
});

describe('captureCommentAssets', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(writeBinaryFile).mockImplementation(async (dir, name) => `${dir}/${name}`);
    vi.mocked(writeJsonFile).mockImplementation(async (dir, name) => `${dir}/${name}`);
  });

  it('captures a single scroll screenshot', async () => {
    vi.mocked(planCommentMultipart).mockResolvedValue({
      mode: 'single',
      plannedParts3plus: 1,
      scrollParts: [0],
      totalParts: 1,
      use3plusRoute: false,
    } as never);
    vi.mocked(ensureHighlightReady).mockResolvedValue({ ok: true });
    const page = buildPage([1, 2, 3]);
    const handle = buildHandle({ ok: true });
    const session = baseSession();

    const result = await captureCommentAssets(
      page as never,
      handle as never,
      data as never,
      '/tmp/out',
      session,
      1,
      null,
    );

    const firstCall = vi.mocked(writeBinaryFile).mock.calls[0] || [];
    expect(firstCall[0]).toBe('/tmp/out');
    expect(firstCall[1]).toBe('uuid-1.png');
    expect(firstCall[2]).toBeInstanceOf(Uint8Array);
    expect(result.screenshotPaths).toEqual(['/tmp/out/uuid-1.png']);
    expect(result.screenshotKeys).toEqual(['uuid-1.png']);
    expect(result.metadataPath).toBe('/tmp/out/uuid-1.json');
    expect(page.url).toHaveBeenCalled();
    expect(writeJsonFile).toHaveBeenCalledOnce();
    expect(result.lastScreenshotHash).toBeTruthy();
  });

  it('uses a quick fallback screenshot when highlight is skipped', async () => {
    const page = buildPage([9, 9, 9]);
    const handle = buildHandle({ ok: true });
    const session = baseSession();

    const result = await captureCommentAssets(
      page as never,
      handle as never,
      data as never,
      '/tmp/out',
      session,
      1,
      null,
      true,
    );

    expect(planCommentMultipart).not.toHaveBeenCalled();
    expect(ensureHighlightReady).not.toHaveBeenCalled();
    expect(page.screenshot).toHaveBeenCalledOnce();
    expect(result.screenshotKeys).toEqual(['uuid-1.png']);
    expect(result.metadataPath).toBe('/tmp/out/uuid-1.json');
  });

  it('captures 3plus tile screenshots', async () => {
    vi.mocked(planCommentMultipart).mockResolvedValue({
      mode: 'row',
      plannedParts3plus: 3,
      scrollParts: [0, 1],
      totalParts: 3,
      use3plusRoute: true,
    } as never);
    vi.mocked(ensureHighlightReady).mockResolvedValue({ ok: true });
    const page = buildPage([1, 2, 3], [4, 5, 6], [7, 8, 9]);
    const handle = buildHandle(
      { ok: true, clip: { x: 0, y: 0, width: 10, height: 10 } },
      { ok: true, clip: { x: 0, y: 10, width: 10, height: 10 } },
      { ok: true, clip: { x: 0, y: 20, width: 10, height: 10 } },
    );
    const session = baseSession();

    const result = await captureCommentAssets(
      page as never,
      handle as never,
      data as never,
      '/tmp/out',
      session,
      1,
      null,
    );

    expect(writeBinaryFile).toHaveBeenCalledTimes(3);
    expect(page.screenshot).toHaveBeenCalledTimes(3);
    expect(result.screenshotPaths).toEqual([
      '/tmp/out/uuid-1-element.png',
      '/tmp/out/uuid-1-element-part2.png',
      '/tmp/out/uuid-1-element-part3.png',
    ]);
    expect(result.screenshotKeys).toEqual([
      'uuid-1-element.png',
      'uuid-1-element-part2.png',
      'uuid-1-element-part3.png',
    ]);
    expect(writeJsonFile).toHaveBeenCalledTimes(1);
    expect(result.metadataPath).toBe('/tmp/out/uuid-1-element.json');
  });

  it('stops when verify fails', async () => {
    vi.mocked(planCommentMultipart).mockResolvedValue({
      mode: 'row',
      plannedParts3plus: 2,
      scrollParts: [0, 1],
      totalParts: 2,
      use3plusRoute: false,
    } as never);
    vi.mocked(ensureHighlightReady).mockResolvedValue({ ok: true });
    const page = buildPage([1, 2, 3]);
    const handle = buildHandle({ ok: false });
    const session = baseSession();

    const result = await captureCommentAssets(
      page as never,
      handle as never,
      data as never,
      '/tmp/out',
      session,
      1,
      null,
    );

    expect(writeBinaryFile).not.toHaveBeenCalled();
    expect(result.screenshotPaths).toEqual([]);
    expect(result.screenshotKeys).toEqual([]);
    expect(result.metadataPath).toBeNull();
  });
});
