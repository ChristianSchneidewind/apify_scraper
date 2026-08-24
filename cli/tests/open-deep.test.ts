import { beforeEach, describe, expect, it, vi } from 'vitest';

import { openLikesDeepLink } from '../src/modules/scrape-comments/likers/open-deep.ts';

const buildCandidate = (clicked = false) => ({
  click: vi.fn().mockImplementation(() =>
    clicked ? Promise.resolve(undefined) : Promise.reject(new Error('skip'))),
  scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
});

const buildFilter = (candidate: ReturnType<typeof buildCandidate>) => ({
  count: vi.fn().mockResolvedValue(1),
  filter: vi.fn().mockReturnThis(),
  locator: vi.fn().mockReturnThis(),
  nth: vi.fn().mockReturnValue(candidate),
});

describe('openLikesDeepLink', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns not found when anchor is missing', async () => {
    const anchor = {
      count: vi.fn().mockResolvedValue(0),
      evaluate: vi.fn(),
      locator: vi.fn(),
    };
    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      locator: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(0),
        filter: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(0) }),
        first: vi.fn(() => anchor),
      }),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
    };

    const result = await openLikesDeepLink(page as never, 'https://x', '/p/1');

    expect(result).toEqual({
      clicked: false,
      likesCount: 0,
      reason: 'deep_target_comment_not_found',
    });
  });

  it('clicks the first matching text candidate', async () => {
    const candidate = buildCandidate(true);
    const filter = buildFilter(candidate);
    const anchor = {
      count: vi.fn().mockResolvedValue(1),
      evaluate: vi.fn().mockResolvedValue(7),
      locator: vi.fn().mockReturnValue({ locator: vi.fn().mockReturnValue(filter), filter: vi.fn().mockReturnValue(filter) }),
    };
    const dialogCount = vi.fn().mockResolvedValue(1);
    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      locator: vi.fn().mockImplementation((selector: string) =>
        selector === '[role="dialog"]'
          ? { count: dialogCount }
          : { count: vi.fn().mockResolvedValue(1), first: vi.fn(() => anchor) }),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
    };

    const result = await openLikesDeepLink(page as never, 'https://x', '/p/1');

    expect(result).toEqual({ clicked: true, likesCount: 7, reason: 'pw_text_click_0' });
  });

  it('returns no-like reason when no candidate works', async () => {
    const candidate = buildCandidate(false);
    const filter = buildFilter(candidate);
    const scope = { locator: vi.fn().mockReturnValue(filter) };
    const anchor = {
      count: vi.fn().mockResolvedValue(1),
      evaluate: vi.fn().mockResolvedValue(3),
      locator: vi.fn().mockReturnValue(scope),
    };
    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      locator: vi.fn().mockImplementation((selector: string) =>
        selector === '[role="dialog"]'
          ? { count: vi.fn().mockResolvedValue(0) }
          : { count: vi.fn().mockResolvedValue(1), first: vi.fn(() => anchor) }),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
    };

    const result = await openLikesDeepLink(page as never, 'https://x', '/p/1');

    expect(result).toEqual({
      clicked: false,
      likesCount: 3,
      reason: 'deep_no_like_in_target_comment',
    });
  });
});
