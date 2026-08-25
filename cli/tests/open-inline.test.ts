import { beforeEach, describe, expect, it, vi } from 'vitest';

import { openLikesInline } from '../src/modules/scrape-comments/likers/open-inline.ts';

describe('openLikesInline', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns evaluated payload result', async () => {
    const handle = {
      evaluate: vi.fn().mockResolvedValue({ clicked: true, likesCount: 4, ok: true }),
    };
    const result = await openLikesInline(handle as never, '/p/1');
    expect(result).toEqual({ clicked: true, likesCount: 4, ok: true });
  });

  it('falls back to invalid result payload', async () => {
    const handle = { evaluate: vi.fn().mockResolvedValue(null) };
    const result = await openLikesInline(handle as never, null);
    expect(result).toEqual({
      clicked: false,
      likesCount: 0,
      ok: false,
      reason: 'invalid_result',
    });
  });
});
