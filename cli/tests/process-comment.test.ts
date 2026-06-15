import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/modules/scrape-comments/extract-from-locator.ts', () => ({
  computeCommentUid: vi.fn(),
  extractCommentFromItem: vi.fn(),
  extractCommentFromTime: vi.fn(),
  resolveCommentRowHandle: vi.fn(),
}));
vi.mock('../src/adapters/instagram/highlight.ts', () => ({
  ensureHighlightReady: vi.fn(),
}));
vi.mock('../src/adapters/instagram/visual.ts', () => ({
  prepareCommentScreenshotVisuals: vi.fn(),
}));
vi.mock('../src/modules/scrape-comments/likers/enrich.ts', () => ({
  enrichCommentLikers: vi.fn(),
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
  resolveCommentRowHandle,
} from '../src/modules/scrape-comments/extract-from-locator.ts';
import { enrichCommentLikers } from '../src/modules/scrape-comments/likers/enrich.ts';
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
  seenLoose: new Set<string>(),
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

  it('keeps failed highlight candidates skipped', async () => {
    vi.mocked(extractCommentFromItem).mockResolvedValue(baseData);
    vi.mocked(computeCommentUid).mockResolvedValue('uid-1');
    const rowHandle = {} as never;
    vi.mocked(resolveCommentRowHandle).mockResolvedValue(rowHandle);
    vi.mocked(enrichCommentLikers).mockResolvedValue(baseData);
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
    expect(state.seenStrict.size).toBe(1);
    expect(state.seenLoose.size).toBe(1);
    expect(state.seenUid.size).toBe(1);
    expect(ensureHighlightReady).toHaveBeenCalledWith(expect.anything(), baseData);
    expect(prepareCommentScreenshotVisuals).not.toHaveBeenCalled();
  });

  it('wires likers enrichment and capture on success', async () => {
    vi.mocked(extractCommentFromItem).mockResolvedValue(baseData);
    vi.mocked(computeCommentUid).mockResolvedValue('uid-1');
    vi.mocked(resolveCommentRowHandle).mockResolvedValue({} as never);
    vi.mocked(ensureHighlightReady).mockResolvedValue({ ok: true });
    vi.mocked(prepareCommentScreenshotVisuals).mockResolvedValue(undefined);
    vi.mocked(enrichCommentLikers).mockResolvedValue({
      ...baseData,
      commentLikers: [{ profileUrl: 'https://www.instagram.com/bob/', username: 'bob' }],
      likesCount: 1,
    });
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
      commentLikers: [{ profileUrl: 'https://www.instagram.com/bob/', username: 'bob' }],
      commentUrl: 'https://www.instagram.com/p/abc/c/1',
      index: 1,
      likesCount: 1,
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
    vi.mocked(enrichCommentLikers).mockResolvedValue({
      ...baseData,
      commentLikers: [],
      likesCount: 0,
    });
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
      likesCount: 0,
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
