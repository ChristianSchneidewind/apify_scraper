import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/adapters/instagram/load-script.ts', () => ({
  browserRunElement: vi.fn(),
  browserRunPayload: vi.fn(),
  injectHelpers: (body: string) => body,
}));

import { FORCED_MULTIPART_BASE } from '../src/modules/scrape-comments/multipart/decisions.ts';
import { planCommentMultipart } from '../src/modules/scrape-comments/multipart/planner.ts';

const shortData = {
  commentLikers: [],
  commentPermalink: '/p/abc/c/1',
  datetime: null,
  text: 'short',
  timeText: '1h',
  username: 'alice',
  userProfilePath: '/alice/',
};

const buildHandle = (...results: unknown[]) => ({
  evaluate: vi.fn().mockImplementation(() => Promise.resolve(results.shift())),
});

describe('planCommentMultipart', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('uses safe single fallback for invalid plan', async () => {
    const handle = { evaluate: vi.fn().mockResolvedValue(undefined) };
    const result = await planCommentMultipart(handle as never, shortData as never);
    expect(result).toEqual({
      baseSig: null,
      mode: 'single',
      plannedParts3plus: 1,
      scrollParts: [0],
      totalParts: 1,
      use3plusRoute: false,
    });
  });

  it('forces row multipart for long single text', async () => {
    const data = { ...shortData, text: 'x'.repeat(FORCED_MULTIPART_BASE * 3) };
    const handle = buildHandle({ ok: true, mode: 'single', sig: 'sig-1', tops: [0] });

    const result = await planCommentMultipart(handle as never, data as never);

    expect(result.mode).toBe('row');
    expect(result.scrollParts.length).toBeGreaterThan(1);
    expect(result.use3plusRoute).toBe(true);
  });

  it('keeps valid row plans intact', async () => {
    const handle = { evaluate: vi.fn().mockResolvedValue({ ok: true, mode: 'row', sig: 'sig-2', tops: [0, 1] }) };
    const result = await planCommentMultipart(handle as never, shortData as never);
    expect(result).toEqual({
      baseSig: 'sig-2',
      mode: 'row',
      plannedParts3plus: 2,
      scrollParts: [0, 1],
      totalParts: 2,
      use3plusRoute: false,
    });
  });
});
