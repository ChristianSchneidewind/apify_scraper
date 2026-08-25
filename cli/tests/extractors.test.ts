import { describe, expect, it, vi } from 'vitest';
import {
  computeCommentUid,
  extractCommentFromTime,
  listTimeLocators,
  resolveCommentRowHandle,
} from '../src/modules/scrape-comments/extract-from-locator.ts';

describe('extractors', () => {
  it('extracts comment data from a time locator', async () => {
    const expected = { text: 'hello', username: 'alice' };
    const evaluate = vi.fn()
      .mockResolvedValueOnce(expected)
      .mockResolvedValueOnce(null);
    const result = await extractCommentFromTime({ evaluate } as never);
    expect(result).toEqual({ ...expected, parentCommentPermalink: null });
    expect(evaluate).toHaveBeenCalledWith(expect.any(Function), true);
  });

  it('computes comment uid from time locator', async () => {
    const evaluate = vi.fn().mockResolvedValue('uid-1');
    const result = await computeCommentUid({ evaluate } as never);
    expect(result).toBe('uid-1');
    expect(evaluate).toHaveBeenCalledWith(expect.any(Function), undefined);
  });

  it('lists time locators from page', async () => {
    const elementHandles = vi.fn().mockResolvedValue(['a', 'b']);
    const page = {
      evaluate: vi.fn().mockResolvedValue(false),
      locator: vi.fn().mockReturnValue({ elementHandles }),
    };
    const result = await listTimeLocators(page as never);
    expect(result).toEqual(['a', 'b']);
  });

  it('resolves a tighter comment row handle when available', async () => {
    const row = { id: 'row' };
    const handle = { asElement: vi.fn().mockReturnValue(row) };
    const locator = { evaluateHandle: vi.fn().mockResolvedValue(handle) };
    const result = await resolveCommentRowHandle(locator as never);
    expect(result).toBe(row);
  });
});
