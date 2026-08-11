import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prepareAuthPage } from '../src/adapters/instagram/auth.ts';
import { extractCommentFromTime } from '../src/modules/scrape-comments/extract-from-locator.ts';
import { captureCommentAssets } from '../src/modules/scrape-comments/capture/capture.ts';
import { initScreenshotSession } from '../src/modules/scrape-comments/capture/screenshot-session.ts';

const multipartPlanScript = readFileSync(new URL('../src/modules/scrape-comments/multipart/browser-scripts/multipart-plan.script', import.meta.url), 'utf8');
let browser: Awaited<ReturnType<typeof chromium.launch>>;

afterAll(async () => {
  await browser?.close();
});

describe('local browser fixtures', () => {
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  it('extracts a comment from an Instagram-like DOM fixture', async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <article>
        <a href="/fixture_user/">fixture_user</a>
        <span>This is a fixture comment</span>
        <time datetime="2026-08-11T10:00:00Z">1h</time>
        <span>3 likes</span>
        <a href="/liker_one/">liker_one</a>
        <a href="/liker_two/">liker_two</a>
        <a href="/p/abc/c/42">permalink</a>
      </article>
    `);

    const data = await extractCommentFromTime(page.locator('time') as never);

    expect(data).toMatchObject({
      commentPermalink: '/p/abc/c/42',
      datetime: '2026-08-11T10:00:00Z',
      likesCount: 3,
      text: 'This is a fixture comment',
      timeText: '1h',
      username: 'fixture_user',
    });
    expect(data?.commentLikers).toEqual([
      { profilePath: '/liker_one/', username: 'liker_one' },
      { profilePath: '/liker_two/', username: 'liker_two' },
    ]);
  });

  it('plans multipart capture for a tall comment fixture', async () => {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.setContent(`
      <article style="width: 400px; height: 1200px">
        <a href="/fixture_user/">fixture_user</a>
        <span>${'Long comment '.repeat(80)}</span>
        <time datetime="2026-08-11T10:00:00Z">1h</time>
        <a href="/p/abc/c/42">permalink</a>
      </article>
    `);

    const plan = await page.locator('article').evaluate((el, body) => {
      const factory = new Function(body)() as (payload: Record<string, unknown>) => unknown;
      return factory({ el, commentPermalink: '/p/abc/c/42', userProfilePath: '/fixture_user/', username: 'fixture_user', text: 'Long comment' });
    }, multipartPlanScript) as { mode: string; tops: number[] };

    expect(plan.mode).toBe('row');
    expect(plan.tops.length).toBeGreaterThan(1);
    await page.close();
  });

  it('writes multiple screenshot parts for a tall comment', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'instagram-fixture-'));
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.goto('about:blank');
    await page.setContent(`
      <article style="width: 400px; height: 1200px; overflow: hidden;">
        <a href="/fixture_user/">fixture_user</a>
        <span>${'Long comment '.repeat(80)}</span>
        <time datetime="2026-08-11T10:00:00Z">1h</time>
        <a href="/p/abc/c/42">permalink</a>
      </article>
    `);
    const data = {
      commentPermalink: '/p/abc/c/42', datetime: '2026-08-11T10:00:00Z',
      likesCount: 3, text: 'Long comment', timeText: '1h', username: 'fixture_user',
      userProfilePath: '/fixture_user/',
    };
    const result = await captureCommentAssets(
      page as never, page.locator('article') as never, data as never,
      outDir, initScreenshotSession(), 1, null,
    );

    expect(result.screenshotPaths.length).toBeGreaterThan(1);
    expect(result.screenshotKeys.length).toBe(result.screenshotPaths.length);
    await page.close();
    await rm(outDir, { recursive: true, force: true });
  });

  it('dismisses cookie banners and login walls', async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <button onclick="this.remove()">Allow all cookies</button>
      <div role="dialog"><p>Log in to see more from Instagram</p></div>
    `);

    await prepareAuthPage(page as never);

    expect(await page.getByRole('button', { name: 'Allow all cookies' }).count()).toBe(0);
    expect(await page.locator('[role="dialog"]').count()).toBe(1);
    expect(await page.locator('[role="dialog"]').evaluate((node) => getComputedStyle(node).display)).toBe('none');
    await page.close();
  });
});
