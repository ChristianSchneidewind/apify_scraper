import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/adapters/instagram/load-script.ts', () => ({
  browserRunElement: vi.fn(),
}));

import {
  computeCommentUid,
  extractCommentFromTime,
  listTimeLocators,
  resolveCommentRowHandle,
} from '../src/modules/scrape-comments/extract-from-locator.ts';
import { extractCommentsFromTimes } from '../src/modules/scrape-comments/extract-times.ts';

describe('extractors', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('extracts comment data from time locator', async () => {
    const expected = { text: 'hello', username: 'alice' };
    const locator = { evaluate: vi.fn().mockResolvedValue(expected) };
    const result = await extractCommentFromTime(locator as never);
    expect(result).toBe(expected);
  });

  it('computes comment uid from time locator', async () => {
    const locator = { evaluate: vi.fn().mockResolvedValue('uid-1') };
    const result = await computeCommentUid(locator as never);
    expect(result).toBe('uid-1');
  });

  it('lists time locators from page', async () => {
    const elementHandles = vi.fn().mockResolvedValue(['a', 'b']);
    const page = { locator: vi.fn().mockReturnValue({ elementHandles }) };
    const result = await listTimeLocators(page as never);
    expect(result).toEqual(['a', 'b']);
  });

  it('resolves a tighter comment row handle when available', async () => {
    const row = { id: 'row' };
    const handle = {
      asElement: vi.fn().mockReturnValue(row),
      dispose: vi.fn(),
    };
    const locator = {
      evaluateHandle: vi.fn().mockResolvedValue(handle),
    };

    const result = await resolveCommentRowHandle(locator as never);
    expect(result).toBe(row);
  });

  it('extracts comments from times page payload', async () => {
    const comments = [{ text: 'hello', username: 'alice' }];
    const page = { evaluate: vi.fn().mockResolvedValue(comments) };
    const result = await extractCommentsFromTimes(page as never);
    expect(result).toEqual(comments);
  });
});
