import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/adapters/instagram/highlight.ts', () => ({
  ensureHighlightReady: vi.fn(),
}));
vi.mock('../src/adapters/instagram/load-script.ts', () => ({
  browserRunPayload: vi.fn(),
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
  screenshot: vi.fn().mockImplementation(() => Promise.resolve(new Uint8Array(shots.shift() || [1, 2, 3]))),
  url: vi.fn().mockReturnValue('https://www.instagram.com/p/abc/'),
  waitForTimeout: vi.fn().mockResolvedValue(undefined),
});

const buildHandle = (...results: unknown[]) => ({
  evaluate: vi.fn().mockImplementation(() => Promise.resolve(results.length ? results.shift() : { ok: true })),
});

describe('captureCommentAssets multipart captures', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(writeBinaryFile).mockImplementation(async (dir, name) => `${dir}/${name}`);
    vi.mocked(writeJsonFile).mockImplementation(async (dir, name) => `${dir}/${name}`);
  });

  it('captures 2-part full screenshots', async () => {
    vi.mocked(planCommentMultipart).mockResolvedValue({
      baseSig: 'sig-2',
      mode: 'row',
      plannedParts3plus: 2,
      scrollParts: [0, 1],
      totalParts: 2,
      use3plusRoute: true,
    } as never);
    vi.mocked(ensureHighlightReady).mockResolvedValue({ ok: true });
    const page = buildPage([1, 2, 3], [7, 7, 7], [4, 5, 6], [8, 8, 8]);
    const handle = buildHandle(
      { ok: true, clip: { height: 100, width: 200, x: 10, y: 20 } },
      { ok: true },
      { ok: true, clip: { height: 100, width: 200, x: 10, y: 120 } },
      { ok: true },
    );
    const session = baseSession();

    const result = await captureCommentAssets(page as never, handle as never, data as never, '/tmp/out', session, 1, null);

    expect(writeBinaryFile).toHaveBeenCalledTimes(2);
    expect(result.screenshotPaths).toEqual(['/tmp/out/uuid-1.png', '/tmp/out/uuid-1-part2.png']);
    expect(result.screenshotKeys).toEqual(['uuid-1.png', 'uuid-1-part2.png']);
    const evaluateArgs = handle.evaluate.mock.calls.map((call) => call[1]);
    expect(evaluateArgs).toContainEqual(expect.objectContaining({ body: expect.stringMatching(/\S/), payload: expect.objectContaining({ mode: 'row', partsTotal: 2, top: 0 }) }));
    expect(evaluateArgs).toContainEqual(expect.objectContaining({ body: expect.stringMatching(/\S/), payload: expect.objectContaining({ mode: 'row', partsTotal: 2, top: 1 }) }));
    expect(page.screenshot).toHaveBeenNthCalledWith(1, expect.not.objectContaining({ clip: expect.anything() }));
    expect(page.screenshot).toHaveBeenNthCalledWith(2, expect.objectContaining({ clip: { height: 100, width: 200, x: 10, y: 20 } }));
    expect(page.screenshot).toHaveBeenNthCalledWith(3, expect.not.objectContaining({ clip: expect.anything() }));
    expect(page.screenshot).toHaveBeenNthCalledWith(4, expect.objectContaining({ clip: { height: 100, width: 200, x: 10, y: 120 } }));
    expect(result.metadataPath).toBe('/tmp/out/uuid-1.json');
  });

  it('captures 3plus full screenshots', async () => {
    vi.mocked(planCommentMultipart).mockResolvedValue({
      baseSig: 'sig-3',
      mode: 'row',
      plannedParts3plus: 3,
      scrollParts: [0, 1, 2],
      totalParts: 3,
      use3plusRoute: true,
    } as never);
    vi.mocked(ensureHighlightReady).mockResolvedValue({ ok: true });
    const page = buildPage([1, 2, 3], [4, 5, 6], [7, 8, 9]);
    const handle = buildHandle({ ok: true }, { ok: true }, { ok: true });
    const session = baseSession();

    const result = await captureCommentAssets(page as never, handle as never, data as never, '/tmp/out', session, 1, null);

    expect(writeBinaryFile).toHaveBeenCalledTimes(3);
    const firstEvaluateCall = handle.evaluate.mock.calls[0] || [];
    expect(firstEvaluateCall[0]).toBeTypeOf('function');
    expect(firstEvaluateCall[1]).toEqual(expect.objectContaining({
      body: expect.stringMatching(/\S/),
      payload: expect.objectContaining({ mode: 'row', partsTotal: 3, top: 0 }),
    }));
    expect(page.screenshot).toHaveBeenCalledTimes(3);
    expect(page.screenshot).toHaveBeenNthCalledWith(1, expect.not.objectContaining({ clip: expect.anything() }));
    expect(page.screenshot).toHaveBeenNthCalledWith(2, expect.not.objectContaining({ clip: expect.anything() }));
    expect(page.screenshot).toHaveBeenNthCalledWith(3, expect.not.objectContaining({ clip: expect.anything() }));
    expect(result.screenshotPaths).toEqual(['/tmp/out/uuid-1.png', '/tmp/out/uuid-1-part2.png', '/tmp/out/uuid-1-part3.png']);
    expect(result.screenshotKeys).toEqual(['uuid-1.png', 'uuid-1-part2.png', 'uuid-1-part3.png']);
    expect(writeJsonFile).toHaveBeenCalledTimes(1);
    expect(result.metadataPath).toBe('/tmp/out/uuid-1.json');
  });

  it('stops when verify fails', async () => {
    vi.mocked(planCommentMultipart).mockResolvedValue({
      baseSig: 'sig-stop',
      mode: 'row',
      plannedParts3plus: 2,
      scrollParts: [0, 1],
      totalParts: 2,
      use3plusRoute: true,
    } as never);
    vi.mocked(ensureHighlightReady).mockResolvedValue({ ok: true });
    const page = buildPage([1, 2, 3]);
    const handle = buildHandle({ ok: false });
    const session = baseSession();

    const result = await captureCommentAssets(page as never, handle as never, data as never, '/tmp/out', session, 1, null);

    expect(writeBinaryFile).not.toHaveBeenCalled();
    expect(result.screenshotPaths).toEqual([]);
    expect(result.screenshotKeys).toEqual([]);
    expect(result.metadataPath).toBeNull();
  });
});
