import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/modules/scrape-comments/likers/open-inline.ts', () => ({
  openLikesInline: vi.fn(),
}));
vi.mock('../src/modules/scrape-comments/likers/open-deep.ts', () => ({
  clickLikesInCurrentPage: vi.fn(),
  openLikesDeepLink: vi.fn(),
}));
vi.mock('../src/modules/scrape-comments/likers/collect-dialog.ts', () => ({
  collectLikersFromDialog: vi.fn(),
  isDialogOpen: vi.fn().mockResolvedValue(false),
  nudgeLikersDialogAtEnd: vi.fn().mockResolvedValue(undefined),
  oscillateLikersDialogAtEnd: vi.fn().mockResolvedValue(undefined),
  resetLikersDialogScroll: vi.fn().mockResolvedValue(undefined),
  scrollLikersDialogToEnd: vi.fn().mockResolvedValue(undefined),
  waitForDialogOpen: vi.fn(),
}));

import { collectLikersFromDialog, isDialogOpen, waitForDialogOpen } from '../src/modules/scrape-comments/likers/collect-dialog.ts';
import { clickLikesInCurrentPage, openLikesDeepLink } from '../src/modules/scrape-comments/likers/open-deep.ts';
import { openLikesInline } from '../src/modules/scrape-comments/likers/open-inline.ts';
import { enrichCommentLikers, clearLikersCacheForTests } from '../src/modules/scrape-comments/likers/enrich.ts';

const baseData = {
  commentLikers: [],
  commentPermalink: '/p/abc/c/1',
  datetime: null,
  likesCount: 0,
  text: 'hello',
  timeText: '1h',
  username: 'alice',
  userProfilePath: '/alice/',
};

const buildPage = () => ({
  context: {
    newPage: vi.fn(),
  },
  evaluate: vi.fn(),
  keyboard: { press: vi.fn() },
  waitForTimeout: vi.fn(),
});

describe('enrichCommentLikers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearLikersCacheForTests();
    vi.mocked(isDialogOpen).mockResolvedValue(false);
  });

  it('returns early when inline likes button is not clicked and deep fallback is unavailable', async () => {
    vi.mocked(openLikesInline).mockResolvedValue({ clicked: false, likesCount: 0, ok: true });
    const page = buildPage();

    const result = await enrichCommentLikers(page as never, {} as never, { ...baseData, commentPermalink: null }, 50);
    expect(result.commentLikers).toEqual([]);
    expect(waitForDialogOpen).not.toHaveBeenCalled();
  });

  it('drops pseudo-likers from extraction when no dialog was opened', async () => {
    vi.mocked(openLikesInline).mockResolvedValue({ clicked: false, likesCount: 0, ok: true });
    vi.mocked(clickLikesInCurrentPage).mockResolvedValue({ clicked: false, likesCount: 0, reason: 'none' });
    const page = buildPage();

    const result = await enrichCommentLikers(page as never, {} as never, {
      ...baseData,
      commentLikers: [{ profileUrl: 'https://www.instagram.com/fake/', username: 'fake' }],
      likesCount: 0,
    }, 50);

    expect(result.commentLikers).toEqual([]);
  });

  it('tries deep fallback even when inline probe reports zero', async () => {
    vi.mocked(openLikesInline).mockResolvedValue({ clicked: false, likesCount: 0, ok: true });
    vi.mocked(clickLikesInCurrentPage).mockResolvedValue({ clicked: false, likesCount: 0, reason: 'none' });
    vi.mocked(openLikesDeepLink).mockResolvedValue({ clicked: true, likesCount: 4, reason: 'pw_text_click' });
    vi.mocked(waitForDialogOpen).mockResolvedValue(true);
    vi.mocked(collectLikersFromDialog).mockResolvedValue([
      { profileUrl: 'https://www.instagram.com/dan/', username: 'dan' },
    ]);

    const page = buildPage();
    const deepPage = buildPage();
    vi.mocked(page.context.newPage).mockResolvedValue(deepPage);

    const result = await enrichCommentLikers(page as never, {} as never, { ...baseData, likesCount: 4 }, 50);
    expect(result.likesCount).toBe(4);
    expect(openLikesDeepLink).toHaveBeenCalled();
    expect(result.commentLikers).toEqual([
      { profileUrl: 'https://www.instagram.com/dan/', username: 'dan' },
    ]);
  });

  it('collects likers from dialog after inline click', async () => {
    vi.mocked(openLikesInline).mockResolvedValue({ clicked: true, likesCount: 2, ok: true });
    vi.mocked(waitForDialogOpen).mockResolvedValue(true);
    vi.mocked(collectLikersFromDialog).mockResolvedValue([
      { profileUrl: 'https://www.instagram.com/bob/', username: 'bob' },
    ]);

    const page = buildPage();
    const result = await enrichCommentLikers(page as never, {} as never, { ...baseData }, 50);

    expect(result.commentLikers).toEqual([
      { profileUrl: 'https://www.instagram.com/bob/', username: 'bob' },
    ]);
    expect(result.likesCount).toBe(2);
    expect(collectLikersFromDialog).toHaveBeenCalledWith(page, 50, undefined, 2, expect.any(AbortSignal));
    expect(page.keyboard.press).toHaveBeenCalledWith('Escape');
  });

  it('falls back to deep link when inline click fails', async () => {
    const deepPage = buildPage();
    vi.mocked(openLikesInline).mockResolvedValue({ clicked: false, likesCount: 3, ok: true });
    vi.mocked(clickLikesInCurrentPage).mockResolvedValue({ clicked: false, likesCount: 3, reason: 'none' });
    vi.mocked(deepPage.context.newPage).mockResolvedValue(deepPage);
    vi.mocked(openLikesDeepLink).mockResolvedValue({ clicked: true, likesCount: 3, reason: 'pw_text_click' });
    vi.mocked(waitForDialogOpen).mockResolvedValue(true);
    vi.mocked(collectLikersFromDialog).mockResolvedValue([
      { profileUrl: 'https://www.instagram.com/carol/', username: 'carol' },
    ]);

    const page = buildPage();
    vi.mocked(page.context.newPage).mockResolvedValue(deepPage);

    const result = await enrichCommentLikers(page as never, {} as never, { ...baseData }, 10);

    expect(openLikesDeepLink).toHaveBeenCalled();
    expect(result.commentLikers).toEqual([
      { profileUrl: 'https://www.instagram.com/carol/', username: 'carol' },
    ]);
  });

  it('keeps going when deep fallback rejects', async () => {
    vi.mocked(openLikesInline).mockResolvedValue({ clicked: false, likesCount: 3, ok: true });
    vi.mocked(clickLikesInCurrentPage).mockResolvedValue({ clicked: false, likesCount: 3, reason: 'none' });
    vi.mocked(openLikesDeepLink).mockRejectedValue(new Error('boom'));

    const page = buildPage();
    vi.mocked(page.context.newPage).mockResolvedValue(buildPage());

    const result = await enrichCommentLikers(page as never, {} as never, { ...baseData }, 10);

    expect(result.commentLikers).toEqual([]);
    expect(waitForDialogOpen).not.toHaveBeenCalled();
  });

  it('ignores close dialog failures', async () => {
    vi.mocked(openLikesInline).mockResolvedValue({ clicked: true, likesCount: 2, ok: true });
    vi.mocked(waitForDialogOpen).mockResolvedValue(true);
    vi.mocked(collectLikersFromDialog).mockResolvedValue([]);

    const page = buildPage();
    vi.mocked(page.keyboard.press).mockRejectedValue(new Error('close failed'));

    const result = await enrichCommentLikers(page as never, {} as never, { ...baseData }, 50);

    expect(result.commentLikers).toEqual([]);
  });

  it('raises likesCount to at least collected liker count', async () => {
    vi.mocked(openLikesInline).mockResolvedValue({ clicked: true, likesCount: 0, ok: true });
    vi.mocked(waitForDialogOpen).mockResolvedValue(true);
    vi.mocked(collectLikersFromDialog).mockResolvedValue([
      { profileUrl: 'https://www.instagram.com/u1/', username: 'u1' },
      { profileUrl: 'https://www.instagram.com/u2/', username: 'u2' },
    ]);

    const page = buildPage();
    const result = await enrichCommentLikers(page as never, {} as never, { ...baseData }, 50);

    expect(result.likesCount).toBe(2);
    expect(result.commentLikers).toHaveLength(2);
  });

  it('retries dialog collection in strict mode', async () => {
    vi.mocked(openLikesInline).mockResolvedValue({ clicked: true, likesCount: 3, ok: true });
    vi.mocked(waitForDialogOpen).mockResolvedValue(true);
    vi.mocked(collectLikersFromDialog)
      .mockResolvedValueOnce([{ profileUrl: 'https://www.instagram.com/u1/', username: 'u1' }])
      .mockResolvedValueOnce([
        { profileUrl: 'https://www.instagram.com/u1/', username: 'u1' },
        { profileUrl: 'https://www.instagram.com/u2/', username: 'u2' },
      ])
      .mockResolvedValueOnce([
        { profileUrl: 'https://www.instagram.com/u1/', username: 'u1' },
        { profileUrl: 'https://www.instagram.com/u2/', username: 'u2' },
        { profileUrl: 'https://www.instagram.com/u3/', username: 'u3' },
      ]);

    const page = buildPage();
    const result = await enrichCommentLikers(page as never, {} as never, { ...baseData }, 50, 'strict');

    expect(vi.mocked(collectLikersFromDialog).mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(result.likesCount).toBe(3);
    expect(result.commentLikers).toHaveLength(3);
  });

  it('does extra collection retries for large like dialogs', async () => {
    vi.mocked(openLikesInline).mockResolvedValue({ clicked: true, likesCount: 113, ok: true });
    vi.mocked(waitForDialogOpen).mockResolvedValue(true);
    vi.mocked(collectLikersFromDialog)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ profileUrl: 'https://www.instagram.com/u1/', username: 'u1' }]);

    const page = buildPage();
    const result = await enrichCommentLikers(page as never, {} as never, { ...baseData }, 0);

    expect(collectLikersFromDialog).toHaveBeenCalledTimes(4);
    expect(result.commentLikers).toEqual([{ profileUrl: 'https://www.instagram.com/u1/', username: 'u1' }]);
    expect(result.likesCount).toBe(113);
  });

  it('reuses cached likers for the same permalink and likes count', async () => {
    vi.mocked(openLikesInline).mockResolvedValue({ clicked: true, likesCount: 2, ok: true });
    vi.mocked(waitForDialogOpen).mockResolvedValue(true);
    vi.mocked(collectLikersFromDialog).mockResolvedValue([
      { profileUrl: 'https://www.instagram.com/bob/', username: 'bob' },
      { profileUrl: 'https://www.instagram.com/carol/', username: 'carol' },
    ]);

    const page = buildPage();
    await enrichCommentLikers(page as never, {} as never, { ...baseData, likesCount: 2 }, 50);
    vi.mocked(openLikesInline).mockClear();
    vi.mocked(collectLikersFromDialog).mockClear();

    const cached = await enrichCommentLikers(page as never, {} as never, { ...baseData, likesCount: 2 }, 50);
    expect(openLikesInline).not.toHaveBeenCalled();
    expect(collectLikersFromDialog).not.toHaveBeenCalled();
    expect(cached.commentLikers).toHaveLength(2);
  });

  it('stops retrying when one liker remains unreachable', async () => {
    vi.mocked(openLikesInline).mockResolvedValue({ clicked: true, likesCount: 4, ok: true });
    vi.mocked(waitForDialogOpen).mockResolvedValue(true);
    vi.mocked(collectLikersFromDialog)
      .mockResolvedValueOnce([
        { profileUrl: 'https://www.instagram.com/u1/', username: 'u1' },
        { profileUrl: 'https://www.instagram.com/u2/', username: 'u2' },
        { profileUrl: 'https://www.instagram.com/u3/', username: 'u3' },
      ])
      .mockResolvedValue([
        { profileUrl: 'https://www.instagram.com/u1/', username: 'u1' },
        { profileUrl: 'https://www.instagram.com/u2/', username: 'u2' },
        { profileUrl: 'https://www.instagram.com/u3/', username: 'u3' },
      ]);

    const page = buildPage();
    const result = await enrichCommentLikers(page as never, {} as never, { ...baseData, likesCount: 4 }, 50);

    expect(collectLikersFromDialog).toHaveBeenCalledTimes(3);
    expect(result.commentLikers).toHaveLength(3);
    expect(result.likesCount).toBe(4);
  });
});
