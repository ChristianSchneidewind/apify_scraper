import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/modules/scrape-comments/extract-from-locator.ts', () => ({
  computeCommentUid: vi.fn(),
  extractCommentFromItem: vi.fn(),
  extractCommentFromTime: vi.fn(),
  refindCommentRowHandle: vi.fn(),
  resolveCommentRowHandle: vi.fn(),
}));
vi.mock('../src/adapters/instagram/highlight.ts', () => ({
  ensureHighlightReady: vi.fn(),
}));
vi.mock('../src/adapters/instagram/visual.ts', () => ({
  prepareCommentScreenshotVisuals: vi.fn(),
}));
vi.mock('../src/modules/scrape-comments/capture/capture.ts', () => ({
  captureCommentAssets: vi.fn(),
}));
vi.mock('../src/modules/scrape-comments/capture/debug.ts', () => ({
  dumpCommentDebugArtifacts: vi.fn(),
}));
vi.mock('../src/modules/scrape-comments/capture/screenshot-session.ts', () => ({
  initScreenshotSession: vi.fn(),
}));

import { ensureHighlightReady } from '../src/adapters/instagram/highlight.ts';
import { prepareCommentScreenshotVisuals } from '../src/adapters/instagram/visual.ts';
import { captureCommentAssets } from '../src/modules/scrape-comments/capture/capture.ts';
import { dumpCommentDebugArtifacts } from '../src/modules/scrape-comments/capture/debug.ts';
import { initScreenshotSession } from '../src/modules/scrape-comments/capture/screenshot-session.ts';
import {
  computeCommentUid,
  extractCommentFromItem,
  extractCommentFromTime,
  refindCommentRowHandle,
  resolveCommentRowHandle,
} from '../src/modules/scrape-comments/extract-from-locator.ts';
import { processCommentCandidate } from '../src/modules/scrape-comments/process-comment.ts';

const baseData = {
  commentPermalink: '/p/abc/c/1',
  datetime: null,
  text: 'hello',
  timeText: '1h',
  username: 'alice',
  userProfilePath: '/alice/',
};

const buildState = () => ({
  count: 0,
  lastScreenshotHash: null as string | null,
  newInRound: 0,
  needsLocatorRefresh: false,
  seenLoose: new Set<string>(),
  seenPermalink: new Set<string>(),
  seenStrict: new Set<string>(),
  seenUid: new Set<string>(),
});

const buildPage = () => ({
  url: vi.fn().mockReturnValue('https://www.instagram.com/p/abc/'),
});

describe('processCommentCandidate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(initScreenshotSession).mockReturnValue({
      screenshotKeys: [],
      screenshotPaths: [],
      screenshotUtc: '2026-06-08 12:00:00 UTC',
      screenshotUuid: 'uuid-1',
    });
  });

  it('returns null when extraction fails', async () => {
    vi.mocked(extractCommentFromItem).mockResolvedValue(null);
    vi.mocked(extractCommentFromTime).mockResolvedValue(null);

    const result = await processCommentCandidate(
      buildPage() as never,
      {} as never,
      buildState(),
      { maxCommentLikers: 50, outDir: '/tmp/out' },
    );

    expect(result).toBeNull();
  });

  it('releases failed highlight candidates for a tighter retry', async () => {
    vi.mocked(extractCommentFromItem).mockResolvedValue(baseData);
    vi.mocked(computeCommentUid).mockResolvedValue('uid-1');
    const rowHandle = {} as never;
    vi.mocked(resolveCommentRowHandle).mockResolvedValue(rowHandle);
    vi.mocked(ensureHighlightReady).mockResolvedValue({ ok: false, reason: 'not_ready' });

    const state = buildState();
    const result = await processCommentCandidate(
      buildPage() as never,
      {} as never,
      state,
      { maxCommentLikers: 50, outDir: '/tmp/out' },
    );

    expect(result).toBeNull();
    expect(state.count).toBe(0);
    expect(state.seenStrict.size).toBe(0);
    expect(state.seenLoose.size).toBe(0);
    expect(state.seenPermalink.size).toBe(0);
    expect(state.seenUid.size).toBe(0);
    expect(ensureHighlightReady).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      ...baseData,
      commentLikers: [],
      likersReason: 'liker_collection_disabled',
    }));
    expect(prepareCommentScreenshotVisuals).not.toHaveBeenCalled();
    expect(state.needsLocatorRefresh).toBe(true);
  });

  it('captures a candidate after refinding its virtualized row', async () => {
    vi.mocked(extractCommentFromItem).mockResolvedValue(baseData);
    vi.mocked(computeCommentUid).mockResolvedValue('uid-1');
    const staleHandle = {} as never;
    const freshHandle = {} as never;
    vi.mocked(resolveCommentRowHandle).mockResolvedValue(staleHandle);
    vi.mocked(refindCommentRowHandle).mockResolvedValue(freshHandle);
    vi.mocked(ensureHighlightReady)
      .mockResolvedValueOnce({ ok: false, reason: 'detached_no_fallback' })
      .mockResolvedValueOnce({ ok: true });
    vi.mocked(captureCommentAssets).mockResolvedValue({
      lastScreenshotHash: 'hash-1',
      metadataPath: '/tmp/out/uuid-1.json',
      screenshotKeys: ['uuid-1.png'],
      screenshotPaths: ['uuid-1.png'],
    });

    const result = await processCommentCandidate(
      buildPage() as never,
      {} as never,
      buildState(),
      { maxCommentLikers: 25, outDir: '/tmp/out' },
    );

    expect(result).toMatchObject({ commentPermalink: '/p/abc/c/1' });
    expect(refindCommentRowHandle).toHaveBeenCalledWith(expect.anything(), expect.objectContaining(baseData));
    expect(prepareCommentScreenshotVisuals).toHaveBeenCalledWith(expect.anything(), freshHandle);
  });

  it('skips candidates already seen by permalink', async () => {
    vi.mocked(extractCommentFromItem).mockResolvedValue(baseData);
    vi.mocked(computeCommentUid).mockResolvedValue('uid-2');

    const state = buildState();
    state.seenPermalink.add('/p/abc/c/1');
    const result = await processCommentCandidate(
      buildPage() as never,
      {} as never,
      state,
      { maxCommentLikers: 25, outDir: '/tmp/out' },
    );

    expect(result).toBeNull();
  });

  it('captures without collecting liker profiles', async () => {
    vi.mocked(extractCommentFromItem).mockResolvedValue(baseData);
    vi.mocked(computeCommentUid).mockResolvedValue('uid-1');
    vi.mocked(resolveCommentRowHandle).mockResolvedValue({} as never);
    vi.mocked(ensureHighlightReady).mockResolvedValue({ ok: true });
    vi.mocked(prepareCommentScreenshotVisuals).mockResolvedValue(undefined);
    vi.mocked(captureCommentAssets).mockResolvedValue({
      lastScreenshotHash: 'hash-1',
      metadataPath: '/tmp/out/uuid-1.json',
      screenshotKeys: ['uuid-1.png'],
      screenshotPaths: ['/tmp/out/uuid-1.png'],
    });

    const state = buildState();
    const result = await processCommentCandidate(
      buildPage() as never,
      {} as never,
      state,
      { maxCommentLikers: 25, outDir: '/tmp/out' },
    );

    expect(result).toMatchObject({
      ...baseData,
      commentDeepLink: 'https://www.instagram.com/p/abc/?comment_id=1',
      commentLikers: [],
      commentUrl: 'https://www.instagram.com/p/abc/c/1',
      index: 1,
      likersComplete: false,
      likersReason: 'liker_collection_disabled',
      metadataPath: '/tmp/out/uuid-1.json',
      multipartNeedsReview: false,
      partsTotal: 1,
      screenshotKey: 'uuid-1.png',
      screenshotKeys: ['uuid-1.png'],
      screenshotPath: '/tmp/out/uuid-1.png',
      screenshotPaths: ['/tmp/out/uuid-1.png'],
      sourceUrl: 'https://www.instagram.com/p/abc/',
    });
    expect(ensureHighlightReady).toHaveBeenCalled();
    expect(prepareCommentScreenshotVisuals).toHaveBeenCalled();
    expect(captureCommentAssets).toHaveBeenCalled();
    expect(state.lastScreenshotHash).toBe('hash-1');
  });

  it('dumps debug artifacts when capture fails', async () => {
    vi.mocked(extractCommentFromItem).mockResolvedValue(baseData);
    vi.mocked(computeCommentUid).mockResolvedValue('uid-1');
    vi.mocked(resolveCommentRowHandle).mockResolvedValue({} as never);
    vi.mocked(ensureHighlightReady).mockResolvedValue({ ok: true });
    vi.mocked(prepareCommentScreenshotVisuals).mockResolvedValue(undefined);
    vi.mocked(captureCommentAssets).mockRejectedValue(new Error('boom'));

    const state = buildState();
    const result = await processCommentCandidate(
      buildPage() as never,
      {} as never,
      state,
      { maxCommentLikers: 25, outDir: '/tmp/out' },
    );

    expect(result).toMatchObject({
      ...baseData,
      commentDeepLink: 'https://www.instagram.com/p/abc/?comment_id=1',
      commentLikers: [],
      commentUrl: 'https://www.instagram.com/p/abc/c/1',
      index: 1,
      likersComplete: false,
      likersReason: 'liker_collection_disabled',
      metadataPath: null,
      multipartNeedsReview: false,
      partsTotal: 0,
      screenshotKey: null,
      screenshotKeys: [],
      screenshotPath: null,
      screenshotPaths: [],
      sourceUrl: 'https://www.instagram.com/p/abc/',
    });
    expect(dumpCommentDebugArtifacts).toHaveBeenCalled();
    expect(state.lastScreenshotHash).toBeNull();
  });
});
