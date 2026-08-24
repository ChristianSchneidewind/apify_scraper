import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prepareAuthPage } from '../src/adapters/instagram/auth.ts';
import { extractCommentFromTime } from '../src/modules/scrape-comments/extract-from-locator.ts';
import { captureCommentAssets } from '../src/modules/scrape-comments/capture/capture.ts';
import { initScreenshotSession } from '../src/modules/scrape-comments/capture/screenshot-session.ts';
import { planMultipartBrowser } from '../src/modules/scrape-comments/multipart/browser.ts';
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
    expect(data?.commentLikers).toEqual([]);
  });

  it('does not treat a verified username label as a short comment', async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <article><a href="/alice/">aliceVerified</a><span>aliceVerified</span>
        <span>Wtf</span><time>1h</time><a href="/post/c/9">comment</a>
      </article>
    `);
    const data = await extractCommentFromTime(page.locator('time') as never);
    expect(data).toMatchObject({ text: 'Wtf', username: 'alice' });
    await page.close();
  });

  it('keeps real reply text and resolves its parent permalink', async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <article><a href="/parent/c/10">parent</a>
        <div>Hide all replies<ul><li>
          <a href="/alice/">aliceVerified</a><span>alice</span><span>5 Wo. · Bearbeitet</span>
          <span>Actual reply text</span><span>Gefällt 3 Mal</span><time datetime="2026-08-11T11:00:00Z">5 Wo.</time>
          <a href="/post/c/11">reply</a>
        </li></ul></div>
      </article>
    `);
    const data = await extractCommentFromTime(page.locator('time') as never);
    expect(data).toMatchObject({
      likesCount: 3,
      parentCommentPermalink: '/parent/c/10',
      text: 'Actual reply text',
      username: 'alice',
    });
    await page.close();
  });

  it('plans multipart capture for an inner-scroll comment', async () => {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.setContent(`
      <article><a href="/fixture_user/">fixture_user</a><time>1h</time>
        <div style="height:100px; overflow-y:auto"><div style="height:700px">Long text</div></div>
      </article>
    `);
    const plan = await page.locator('article').evaluate(planMultipartBrowser, {
      commentPermalink: null, text: 'Long text',
      userProfilePath: '/fixture_user/', username: 'fixture_user',
    });
    expect(plan.mode).toBe('inner');
    expect(plan.metrics?.hasInnerScroll).toBe(true);
    expect(plan.tops?.length).toBeGreaterThan(1);
    await page.close();
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

    const plan = await page.locator('article').evaluate(planMultipartBrowser, {
      commentPermalink: '/p/abc/c/42',
      text: 'Long comment',
      userProfilePath: '/fixture_user/',
      username: 'fixture_user',
    });

    expect(plan.mode).toBe('row');
    expect(plan.tops?.length).toBeGreaterThan(1);
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
    const screenshots = await Promise.all(result.screenshotPaths.map((path) => readFile(path)));
    const unique = new Set(screenshots.map((buffer) => buffer.toString('base64')));
    expect(unique.size).toBe(screenshots.length);
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
    await page.evaluate(() => document.body.insertAdjacentHTML(
      'beforeend', '<div id="late-wall" role="dialog">Log in to continue</div>',
    ));
    await page.waitForTimeout(600);
    expect(await page.locator('#late-wall').evaluate((node) => getComputedStyle(node).display)).toBe('none');
    await page.close();
  });
});
