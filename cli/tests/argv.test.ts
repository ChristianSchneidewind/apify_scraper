import { describe, expect, it } from 'vitest';
import { parseCommandRequest } from '../src/core/argv.ts';

describe('parseCommandRequest', () => {
  it('parses auth login with browser profile', () => {
    const request = parseCommandRequest([
      'node',
      'instagram',
      'auth',
      'login',
      '--browser-profile',
      'work',
    ]);
    expect(request?.command).toBe('auth.login');
    expect(request?.options.browserProfile).toBe('work');
  });
});
