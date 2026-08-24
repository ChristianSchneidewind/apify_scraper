import { beforeEach, describe, expect, it, vi } from 'vitest';

import { openLikesDeepLink } from '../src/modules/scrape-comments/likers/open-deep.ts';

const buildPage = (options: {
  anchorCount: number;
  dialogCount: number;
  evaluate?: ReturnType<typeof vi.fn>;
}) => ({
  evaluate: options.evaluate ?? vi.fn().mockResolvedValue(false),
  goto: vi.fn().mockResolvedValue(undefined),
  locator: vi.fn().mockImplementation((selector: string) => ({
    count: vi.fn().mockResolvedValue(
      selector === '[role="dialog"]' ? options.dialogCount : options.anchorCount,
    ),
  })),
  waitForTimeout: vi.fn().mockResolvedValue(undefined),
});

describe('openLikesDeepLink', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns not found when anchor is missing', async () => {
    const page = buildPage({ anchorCount: 0, dialogCount: 0 });

    const result = await openLikesDeepLink(page as never, 'https://x', '/p/1');

    expect(result).toEqual({
      clicked: false,
      likesCount: 0,
      reason: 'deep_target_comment_not_found',
    });
  });

  it('clicks the first matching text candidate and verifies the dialog', async () => {
    const evaluate = vi.fn().mockResolvedValue({ likesCount: 7, status: 'clicked' });
    const page = buildPage({ anchorCount: 1, dialogCount: 1, evaluate });

    const result = await openLikesDeepLink(page as never, 'https://x', '/p/1');

    expect(result).toEqual({ clicked: true, likesCount: 7, reason: 'cdp_text_click_0' });
  });

  it('returns no-like reason when no candidate exists', async () => {
    const evaluate = vi.fn().mockResolvedValue({ likesCount: 3, status: 'no_candidate' });
    const page = buildPage({ anchorCount: 1, dialogCount: 0, evaluate });

    const result = await openLikesDeepLink(page as never, 'https://x', '/p/1');

    expect(result).toEqual({
      clicked: false,
      likesCount: 3,
      reason: 'deep_no_like_in_target_comment',
    });
  });

  it('keeps probing when the dialog does not open after a click', async () => {
    const evaluate = vi.fn().mockResolvedValue({ likesCount: 5, status: 'clicked' });
    const page = buildPage({ anchorCount: 1, dialogCount: 0, evaluate });

    const result = await openLikesDeepLink(page as never, 'https://x', '/p/1');

    expect(result.clicked).toBe(false);
    expect(evaluate).toHaveBeenCalled();
  });
});
