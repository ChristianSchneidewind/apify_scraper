import { describe, expect, it } from 'vitest';
import { exitCodeForResult, failFromReason, failResult, okResult } from '../src/core/result.ts';

describe('exitCodeForResult', () => {
  it('returns success code for ok results', () => {
    expect(exitCodeForResult(okResult('scrape.comments', 'ok'))).toBe(0);
  });

  it('returns usage code for invalid input', () => {
    expect(exitCodeForResult(failResult('auth.login', 'invalid command input'))).toBe(2);
  });

  it('returns auth code for auth failures', () => {
    expect(exitCodeForResult(failResult('auth.login', 'auth failed'))).toBe(3);
  });

  it('returns browser code for browser failures', () => {
    expect(exitCodeForResult(failResult('scrape.comments', 'browser launch failed'))).toBe(4);
  });

  it('returns scrape code for scrape failures', () => {
    expect(exitCodeForResult(failResult('scrape.profiles', 'scrape failed'))).toBe(5);
  });

  it('uses reason messages when present', () => {
    const result = failFromReason('scrape.comments', new Error('browser launch failed'), 'fallback');
    expect(result.summary).toBe('browser launch failed');
  });
});
