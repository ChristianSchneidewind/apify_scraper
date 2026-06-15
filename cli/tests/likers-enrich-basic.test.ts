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
import { baseData, buildPage } from './likers-enrich-fixtures.ts';

describe('enrichCommentLikers basics', () => {
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
    expect(collectLikersFromDialog).toHaveBeenCalled();
    expect(vi.mocked(collectLikersFromDialog).mock.calls[0]?.[3]).toBe(2);
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
});
