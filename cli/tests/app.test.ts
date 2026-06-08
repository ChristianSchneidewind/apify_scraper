import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/modules/auth/login.ts', () => ({
  runAuthLogin: async () => ({
    command: 'auth.login',
    details: { browserProfile: 'work', storageStatePath: '/tmp/state.json' },
    ok: true,
    summary: 'auth login saved for profile work',
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
  it('returns auth login result', async () => {
    const result = await runApp([
      'node',
      'instagram',
      'auth',
      'login',
      '--browser-profile',
      'work',
    ]);
    expect(result.command).toBe('auth.login');
    expect(result.ok).toBe(true);
    expect(result.details.browserProfile).toBe('work');
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
