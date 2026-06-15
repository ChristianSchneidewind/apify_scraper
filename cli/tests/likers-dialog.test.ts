import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  collectLikersFromDialog,
  waitForDialogOpen,
} from '../src/modules/scrape-comments/likers/collect-dialog.ts';

const buildPage = (...results: unknown[]) => ({
  evaluate: vi.fn().mockImplementation(() => Promise.resolve(results.shift())),
  waitForTimeout: vi.fn().mockResolvedValue(undefined),
  keyboard: { press: vi.fn().mockResolvedValue(undefined) },
});

describe('likers dialog', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('collects and deduplicates likers', async () => {
    const page = buildPage(
      {
        canScroll: true,
        items: [
          { profilePath: '/bob/', username: 'bob' },
          { profilePath: '/bob/', username: 'bob' },
          { profilePath: 'https://www.instagram.com/carol/', username: 'carol' },
        ],
        open: true,
      },
      { canScroll: false, items: [], open: false },
    );

    const result = await collectLikersFromDialog(page as never, 50);

    expect(result).toEqual([
      { profileUrl: 'https://www.instagram.com/bob/', username: 'bob' },
      { profileUrl: 'https://www.instagram.com/carol/', username: 'carol' },
    ]);
  });

  it('respects liker limit', async () => {
    const page = buildPage({
      canScroll: true,
      items: [
        { profilePath: '/bob/', username: 'bob' },
        { profilePath: '/carol/', username: 'carol' },
      ],
      open: true,
    });

    const result = await collectLikersFromDialog(page as never, 1);

    expect(result).toEqual([
      { profileUrl: 'https://www.instagram.com/bob/', username: 'bob' },
    ]);
  });

  it('waits until dialog is open', async () => {
    const page = buildPage(false, false, true);
    const result = await waitForDialogOpen(page as never);
    expect(result).toBe(true);
    expect(page.waitForTimeout).toHaveBeenCalledTimes(2);
  });

  it('nudges scrolling when the dialog stalls', async () => {
    const page = buildPage(
      { canScroll: false, items: [{ profilePath: '/bob/', username: 'bob' }], open: true },
      { canScroll: false, items: [{ profilePath: '/bob/', username: 'bob' }], open: true },
      { canScroll: false, items: [], open: false },
    );

    const result = await collectLikersFromDialog(page as never, 0);

    expect(result).toEqual([{ profileUrl: 'https://www.instagram.com/bob/', username: 'bob' }]);
    expect(page.keyboard.press).toHaveBeenCalledWith('End');
  });
});
