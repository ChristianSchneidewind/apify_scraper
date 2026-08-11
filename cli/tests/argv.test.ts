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

  it('parses tsx script invocation with global flags', () => {
    const request = parseCommandRequest([
      'node',
      '/tmp/tsx',
      'cli/src/bin/instagram.ts',
      '--browser-profile',
      'default',
      'scrape',
      'comments',
      '--url',
      'https://www.instagram.com/p/abc/',
    ]);
    expect(request?.command).toBe('scrape.comments');
    expect(request?.options.browserProfile).toBe('default');
  });

  it('parses cwd overrides', () => {
    const request = parseCommandRequest([
      'node',
      'instagram',
      'scrape',
      'profiles',
      '--cwd',
      '/tmp/project',
      '--url',
      'https://www.instagram.com/nasa/',
      '--out-dir',
      'profiles',
    ]);
    expect(request?.options.cwd).toBe('/tmp/project');
  });

  it('parses plain output mode', () => {
    const request = parseCommandRequest([
      'node',
      'instagram',
      'scrape',
      'comments',
      '--plain',
      '--url',
      'https://www.instagram.com/p/abc/',
    ]);
    expect(request?.options.plain).toBe(true);
  });

  it('defaults to headful browser mode', () => {
    const request = parseCommandRequest([
      'node',
      'instagram',
      'scrape',
      'comments',
      '--url',
      'https://www.instagram.com/p/abc/',
    ]);
    expect(request?.options.headful).toBe(true);
  });

  it('parses headless override', () => {
    const request = parseCommandRequest([
      'node',
      'instagram',
      'scrape',
      'comments',
      '--headless',
      '--url',
      'https://www.instagram.com/p/abc/',
    ]);
    expect(request?.options.headful).toBe(false);
  });

  it('parses liker retry controls', () => {
    const request = parseCommandRequest([
      'node', 'instagram', 'scrape', 'comments',
      '--liker-retry-attempts', '4',
      '--liker-retry-delay-ms', '1500',
      '--liker-timeout-ms', '12000',
      '--url', 'https://www.instagram.com/p/abc/',
    ]);
    expect(request?.command).toBe('scrape.comments');
    if (request?.command !== 'scrape.comments') throw new Error('expected scrape.comments');
    expect(request.options.likerRetryAttempts).toBe(4);
    expect(request.options.likerRetryDelayMs).toBe(1500);
    expect(request.options.likerTimeoutMs).toBe(12000);
  });

  it('parses liker flags', () => {
    const request = parseCommandRequest([
      'node',
      'instagram',
      'scrape',
      'comments',
      '--liker-collection-mode',
      'strict',
      '--max-comment-likers',
      '25',
      '--url',
      'https://www.instagram.com/p/abc/',
    ]);
    expect(request?.command).toBe('scrape.comments');
    if (request?.command !== 'scrape.comments') throw new Error('expected scrape.comments');
    expect(request.options.likerCollectionMode).toBe('strict');
    expect(request.options.maxCommentLikers).toBe(25);
  });
});
