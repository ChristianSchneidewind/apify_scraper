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
import { openLikesInline } from '../src/modules/scrape-comments/likers/open-inline.ts';
import { enrichCommentLikers, clearLikersCacheForTests } from '../src/modules/scrape-comments/likers/enrich.ts';
import { baseData, buildPage } from './likers-enrich-fixtures.ts';

describe('enrichCommentLikers retries', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearLikersCacheForTests();
    vi.mocked(isDialogOpen).mockResolvedValue(false);
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
