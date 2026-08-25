import { execFileSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { renderPlainResult } from '../src/core/output.ts';

vi.mock('../src/modules/auth/login.ts', () => ({
  runAuthLogin: async () => ({
    command: 'auth.login',
    details: { cdpUrl: 'http://127.0.0.1:9222' },
    ok: true,
    summary: 'instagram session active in the connected Chrome profile',
  }),
}));
vi.mock('../src/modules/scrape-comments/run.ts', () => ({
  runScrapeComments: async () => ({
    command: 'scrape.comments',
    details: { commentsCount: '1', outputPath: '/tmp/comments.json' },
    ok: true,
    summary: 'scraped 1 comments',
  }),
}));
vi.mock('../src/modules/scrape-profiles/run.ts', () => ({
  runScrapeProfiles: async () => ({
    command: 'scrape.profiles',
    details: { jsonPath: '/tmp/nasa.json', screenshotPath: '/tmp/nasa.png' },
    ok: true,
    summary: 'scraped profile artifacts',
  }),
}));

import { runApp } from '../src/core/app.ts';

describe('runApp', () => {
  it('returns empty ok result for help output', async () => {
    const result = await runApp(['node', 'instagram', '--help']);
    expect(result.ok).toBe(true);
    expect(result.summary).toBe('');
  });

  it('returns empty ok result for version output', async () => {
    const result = await runApp(['node', 'instagram', '--version']);
    expect(result.ok).toBe(true);
    expect(result.summary).toBe('');
  });

  it('renders help output from the binary', () => {
    const output = execFileSync('node', ['--import', 'tsx', 'cli/src/bin/instagram.ts', '--help'], {
      encoding: 'utf8',
    });
    expect(output).toContain('Usage');
    expect(output).toContain('auth login');
  }, 15_000);

  it('renders version output from the binary', () => {
    const output = execFileSync('node', ['--import', 'tsx', 'cli/src/bin/instagram.ts', '--version'], {
      encoding: 'utf8',
    });
    expect(output).toContain('0.1.0');
  });

  it('renders plain output', () => {
    const output = renderPlainResult({
      command: 'scrape.comments',
      details: { commentsCount: '1', jsonPath: '/tmp/comments.json' },
      ok: true,
      summary: 'scraped 1 comments',
    });
    expect(output).toContain('OK');
    expect(output).toContain('scrape.comments');
    expect(output).toContain('commentsCount=1');
  });

  it('returns auth login result', async () => {
    const result = await runApp([
      'node',
      'instagram',
      'auth',
      'login',
      '--cdp-url',
      'http://127.0.0.1:9222',
    ]);
    expect(result.command).toBe('auth.login');
    expect(result.ok).toBe(true);
    expect(result.details.cdpUrl).toBe('http://127.0.0.1:9222');
  });

  it('shows a standalone cdp connection without opening a browser', async () => {
    const result = await runApp([
      'node', 'instagram', '--cdp-url', 'http://127.0.0.1:9333',
    ]);
    expect(result).toMatchObject({
      command: 'profile.show',
      details: { cdpUrl: 'http://127.0.0.1:9333' },
      ok: true,
      summary: 'cdp connection: http://127.0.0.1:9333',
    });
  });

  it('rejects malformed or unknown standalone profile options', async () => {
    const missing = await runApp(['node', 'instagram', '--cdp-url', '--json']);
    const unknown = await runApp(['node', 'instagram', '--cdp-url', 'http://x', '--bogus']);
    const cwd = await runApp(['node', 'instagram', '--cdp-url', 'http://x', '--cwd', '--json']);
    const command = await runApp([
      'node', 'instagram', 'scrape', 'comments', '--url', 'https://example.com',
      '--dry-run', '--bogus',
    ]);
    expect(missing.ok).toBe(false);
    expect(unknown.ok).toBe(false);
    expect(cwd.ok).toBe(false);
    expect(command.ok).toBe(false);
  });

  it('renders command help when global options lead the command', () => {
    const output = execFileSync('node', [
      '--import', 'tsx', 'cli/src/bin/instagram.ts',
      '--cdp-url', 'http://127.0.0.1:9222', 'scrape', 'comments', '--help',
    ], { encoding: 'utf8' });
    expect(output).toContain('--max-comments');
  });

  it('supports dry-run without executing the command', async () => {
    const result = await runApp([
      'node',
      'instagram',
      'scrape',
      'comments',
      '--url',
      'https://www.instagram.com/p/abc/',
      '--dry-run',
    ]);
    expect(result).toEqual({
      command: 'scrape.comments',
      details: {},
      ok: true,
      summary: 'dry run: would execute scrape.comments',
    });
  });

  it('routes scrape comments', async () => {
    const result = await runApp([
      'node',
      'instagram',
      'scrape',
      'comments',
      '--url',
      'https://www.instagram.com/p/abc/',
    ]);
    expect(result.command).toBe('scrape.comments');
    expect(result.ok).toBe(true);
  });

  it('routes tsx script invocation with global flags', async () => {
    const result = await runApp([
      'node',
      '/tmp/tsx',
      'cli/src/bin/instagram.ts',
      '--cdp-url',
      'http://127.0.0.1:9222',
      'scrape',
      'comments',
      '--url',
      'https://www.instagram.com/p/abc/',
    ]);
    expect(result.command).toBe('scrape.comments');
    expect(result.ok).toBe(true);
  });

  it('routes scrape profiles', async () => {
    const result = await runApp([
      'node',
      'instagram',
      'scrape',
      'profiles',
      '--url',
      'https://www.instagram.com/nasa/',
      '--out-dir',
      'profiles',
    ]);
    expect(result.command).toBe('scrape.profiles');
    expect(result.ok).toBe(true);
  });

  it('rejects unknown commands', async () => {
    const result = await runApp(['node', 'instagram', 'nope']);
    expect(result.ok).toBe(false);
  });
});
