import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/adapters/instagram/highlight.ts', () => ({
  ensureHighlightReady: vi.fn(),
}));
vi.mock('../src/adapters/filesystem/output.ts', () => ({
  appendTextFile: vi.fn().mockResolvedValue('/tmp/out/capture-debug.jsonl'),
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
  evaluate: vi.fn().mockImplementation(() => Promise.resolve(results.length ? results.shift() : { ok: true })),
});

describe('captureCommentAssets', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(writeBinaryFile).mockImplementation(async (dir, name) => `${dir}/${name}`);
    vi.mocked(writeJsonFile).mockImplementation(async (dir, name) => `${dir}/${name}`);
  });

  it('captures a single scroll screenshot without clipping', async () => {
    vi.mocked(planCommentMultipart).mockResolvedValue({
      mode: 'single',
      plannedParts3plus: 1,
      scrollParts: [0],
      totalParts: 1,
      use3plusRoute: false,
    } as never);
    vi.mocked(ensureHighlightReady).mockResolvedValue({ ok: true });
    const page = buildPage([1, 2, 3]);
    const handle = buildHandle({ ok: true, clippedBottom: false, metrics: { overflow: 0, rowHeight: 240, visibleH: 600 } }, { ok: true });
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
    expect(page.screenshot).toHaveBeenCalledWith(expect.not.objectContaining({ clip: expect.anything() }));
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

  it('escalates a clipped single comment to multipart full screenshots', async () => {
    vi.mocked(planCommentMultipart).mockResolvedValue({
      baseSig: 'sig-escalate',
      mode: 'single',
      plannedParts3plus: 1,
      scrollParts: [0],
      totalParts: 1,
      use3plusRoute: false,
    } as never);
    vi.mocked(ensureHighlightReady).mockResolvedValue({ ok: true });
    const page = buildPage([1, 2, 3], [4, 5, 6]);
    const handle = buildHandle(
      { ok: true, clippedBottom: true, metrics: { overflow: 180, rowHeight: 780, visibleH: 600 } },
      { ok: true },
      { ok: true },
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

    expect(writeBinaryFile).toHaveBeenCalledTimes(2);
    expect(result.screenshotKeys).toEqual([
      'uuid-1.png',
      'uuid-1-part2.png',
    ]);
    const firstEvaluateCall = handle.evaluate.mock.calls[0] || [];
    const secondEvaluateCall = handle.evaluate.mock.calls[1] || [];
    expect(firstEvaluateCall[0]).toBeTypeOf('function');
    expect(firstEvaluateCall[1]).toEqual(expect.objectContaining({
      mode: 'single', partsTotal: 1, top: 0,
    }));
    expect(secondEvaluateCall[0]).toBeTypeOf('function');
    expect(secondEvaluateCall[1]).toEqual(expect.objectContaining({
      mode: 'row', partsTotal: 2, top: 0,
    }));
    expect(page.screenshot).toHaveBeenNthCalledWith(1, expect.not.objectContaining({ clip: expect.anything() }));
    expect(page.screenshot).toHaveBeenNthCalledWith(2, expect.not.objectContaining({ clip: expect.anything() }));
    expect(result.metadataPath).toBe('/tmp/out/uuid-1.json');
  });

});
