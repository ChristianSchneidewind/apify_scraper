import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  collectLikersFromDialog,
  waitForDialogOpen,
} from '../src/modules/scrape-comments/likers/collect-dialog.ts';

const buildPage = (...results: unknown[]) => ({
  evaluate: vi.fn().mockImplementation(() => Promise.resolve(results.shift())),
  waitForTimeout: vi.fn().mockResolvedValue(undefined),
  keyboard: { press: vi.fn().mockResolvedValue(undefined) },
  url: vi.fn().mockReturnValue('https://www.instagram.com/p/test/'),
});

describe('likers dialog', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('collects and deduplicates likers', async () => {
    const page = buildPage(
      true,
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
    const page = buildPage(
      true,
      {
        canScroll: true,
        items: [
          { profilePath: '/bob/', username: 'bob' },
          { profilePath: '/carol/', username: 'carol' },
        ],
        open: true,
      },
    );

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

  it('accumulates likers across virtualized scroll rounds', async () => {
    const page = buildPage(
      true,
      {
        canScroll: true,
        items: Array.from({ length: 12 }, (_, i) => ({
          profilePath: `/user${i}/`,
          username: `user${i}`,
        })),
        open: true,
      },
      {
        canScroll: true,
        items: Array.from({ length: 12 }, (_, i) => ({
          profilePath: `/user${i + 10}/`,
          username: `user${i + 10}`,
        })),
        open: true,
      },
      {
        canScroll: true,
        items: Array.from({ length: 8 }, (_, i) => ({
          profilePath: `/user${i + 20}/`,
          username: `user${i + 20}`,
        })),
        open: true,
      },
      { canScroll: false, items: [], open: false },
    );

    const result = await collectLikersFromDialog(page as never, 0, false, 28);

    expect(result).toHaveLength(28);
    expect(result.map((item) => item.username)).toEqual(
      Array.from({ length: 28 }, (_, i) => `user${i}`),
    );
  });

  it('nudges scrolling when the dialog stalls', async () => {
    const page = buildPage(
      true,
      { canScroll: false, items: [{ profilePath: '/bob/', username: 'bob' }], open: true },
      { canScroll: false, items: [{ profilePath: '/bob/', username: 'bob' }], open: true },
      { canScroll: false, items: [], open: false },
    );

    const result = await collectLikersFromDialog(page as never, 0);

    expect(result).toEqual([{ profileUrl: 'https://www.instagram.com/bob/', username: 'bob' }]);
    expect(page.keyboard.press).toHaveBeenCalledWith('End');
  });

  it('returns partial results when collection is aborted', async () => {
    const controller = new AbortController();
    const page = {
      evaluate: vi.fn().mockImplementation(() => {
        if (page.evaluate.mock.calls.length >= 3) controller.abort();
        return Promise.resolve({
          canScroll: true,
          items: [{ profilePath: `/user${page.evaluate.mock.calls.length}/`, username: `user${page.evaluate.mock.calls.length}` }],
          open: true,
        });
      }),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      keyboard: { press: vi.fn().mockResolvedValue(undefined) },
      url: vi.fn().mockReturnValue('https://www.instagram.com/p/test/'),
    };

    const result = await collectLikersFromDialog(page as never, 0, false, 0, controller.signal);

    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThan(28);
  });

  it('runs a final sweep when one liker is still missing', async () => {
    const page = buildPage(
      true,
      {
        canScroll: false,
        items: Array.from({ length: 3 }, (_, i) => ({
          profilePath: `/user${i}/`,
          username: `user${i}`,
        })),
        open: true,
      },
      {
        canScroll: false,
        items: [
          { profilePath: '/user0/', username: 'user0' },
          { profilePath: '/user1/', username: 'user1' },
          { profilePath: '/user2/', username: 'user2' },
          { profilePath: '/user3/', username: 'user3' },
        ],
        open: true,
      },
      { canScroll: false, items: [], open: false },
    );

    const result = await collectLikersFromDialog(page as never, 0, false, 4);

    expect(result).toHaveLength(4);
    expect(result.map((item) => item.username)).toEqual(['user0', 'user1', 'user2', 'user3']);
  });

  it('oscillates at the tail when one liker is still missing', async () => {
    const page = buildPage(
      true,
      {
        canScroll: false,
        items: Array.from({ length: 3 }, (_, i) => ({
          profilePath: `/user${i}/`,
          username: `user${i}`,
        })),
        open: true,
      },
      {
        canScroll: false,
        items: Array.from({ length: 3 }, (_, i) => ({
          profilePath: `/user${i}/`,
          username: `user${i}`,
        })),
        open: true,
      },
      {
        canScroll: false,
        items: [
          { profilePath: '/user0/', username: 'user0' },
          { profilePath: '/user1/', username: 'user1' },
          { profilePath: '/user2/', username: 'user2' },
          { profilePath: '/user3/', username: 'user3' },
        ],
        open: true,
      },
      { canScroll: false, items: [], open: false },
    );

    const result = await collectLikersFromDialog(page as never, 0, false, 4);

    expect(result).toHaveLength(4);
    expect(result.map((item) => item.username)).toEqual(['user0', 'user1', 'user2', 'user3']);
  });

  it('stops rewinding when one missing liker stays unrecoverable', async () => {
    const page = buildPage(
      true,
      {
        canScroll: false,
        items: Array.from({ length: 3 }, (_, i) => ({
          profilePath: `/user${i}/`,
          username: `user${i}`,
        })),
        open: true,
      },
      {
        canScroll: false,
        items: Array.from({ length: 3 }, (_, i) => ({
          profilePath: `/user${i}/`,
          username: `user${i}`,
        })),
        open: true,
      },
      { canScroll: false, items: [], open: false },
    );

    const result = await collectLikersFromDialog(page as never, 0, false, 4);

    expect(result).toHaveLength(3);
    expect(page.evaluate.mock.calls.length).toBeLessThan(20);
  });
});
