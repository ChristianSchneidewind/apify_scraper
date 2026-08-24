import { join } from 'node:path';
import type { BinaryWriter, CliOutput, LoggerPort, RepostCapturePage, RepostReadPage, RepostScrollPage, RuntimeContext, ScrapeRepostsOptions } from '../../schemas/index.ts';
import { isLoginRequired } from '../../adapters/instagram/auth.ts';
import { closeBrowserSession, openBrowserSession } from '../../adapters/playwright/browser.ts';
import { ensureOutputDirectory, writeBinaryFile, writeJsonFile } from '../../adapters/filesystem/output.ts';
import { prepareProfileScreenshotVisuals } from '../../adapters/instagram/visual.ts';
import { setScreenshotBanner } from '../scrape-comments/capture/banner.ts';
import { createLogger } from '../../core/logger.ts';
import { makeScreenshotUtc, makeUuid7 } from '../scrape-comments/capture/screenshot-session.ts';
import { extractRepostLinks, waitForImages } from './browser.ts';

const WAIT_AFTER_SCROLL_MS = 750;
const MAX_SCROLL_ROUNDS = 1000;

export const buildRepostsUrl = (profileUrl: string) => {
  const url = new URL(profileUrl);
  const path = url.pathname.replace(/\/+$/, '');
  if (path.endsWith('/reposts')) return url.toString();
  url.pathname = `${path}/reposts`;
  return url.toString();
};

export const readRepostPage = async (page: RepostReadPage) => page.evaluate(() => ({
  width: document.documentElement.scrollWidth,
  height: document.documentElement.scrollHeight,
  viewportHeight: window.innerHeight,
  scrollY: window.scrollY,
}), undefined);

export const collectRepostLinks = async (page: RepostReadPage) => page.evaluate(extractRepostLinks, undefined);

export const scrollRepostsToEnd = async (page: RepostScrollPage, logger?: LoggerPort) => {
  let previousHeight = 0;
  let stableRounds = 0;
  const links = new Set<string>();
  for (let round = 0; round < MAX_SCROLL_ROUNDS; round += 1) {
    const state = await readRepostPage(page);
    (await collectRepostLinks(page)).forEach((link) => links.add(link));
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight), undefined);
    await page.waitForTimeout(WAIT_AFTER_SCROLL_MS);
    const next = await readRepostPage(page);
    (await collectRepostLinks(page)).forEach((link) => links.add(link));
    logger?.debug(`reposts scroll round ${round + 1}`, { height: next.height, scrollY: next.scrollY });
    if (next.height === previousHeight && next.height === state.height) stableRounds += 1;
    else stableRounds = 0;
    previousHeight = next.height;
    if (stableRounds >= 2 && next.scrollY + next.viewportHeight >= next.height - 2) return { ...next, links: [...links] };
  }
  return { ...(await readRepostPage(page)), links: [...links] };
};

export const waitForRepostImages = async (page: RepostReadPage) => page.evaluate(waitForImages, undefined);

export const captureRepostScreenshots = async (page: RepostCapturePage, write: BinaryWriter, pageUrl: string) => {
  const initial = await readRepostPage(page);
  const step = Math.max(1, initial.viewportHeight);
  const total = Math.max(1, Math.ceil(initial.height / step));
  const paths: string[] = [];
  await page.evaluate(() => window.scrollTo(0, 0), undefined);
  for (let index = 0; index < total; index += 1) {
    const top = Math.min(index * step, Math.max(0, initial.height - initial.viewportHeight));
    await page.evaluate((scrollTop: number) => window.scrollTo(0, scrollTop), top);
    await page.waitForTimeout(500);
    await waitForRepostImages(page);
    const screenshotUuid = makeUuid7();
    await page.evaluate(setScreenshotBanner, { text: `${pageUrl}\n${makeScreenshotUtc()} | repost #${index + 1} | ${screenshotUuid.slice(0, 8)} | part ${index + 1}/${total}` });
    paths.push(await write(`${screenshotUuid}.png`, await page.screenshot({ fullPage: false })));
  }
  await page.evaluate(() => window.scrollTo(0, 0), undefined);
  return paths;
};

const profileSlug = (url: string) => new URL(url).pathname.split('/').filter(Boolean)[0] || 'profile';

export const makeRepostsRunFolder = (slug: string) => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const timestamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  return `${timestamp}_${slug}`;
};

export const runScrapeReposts = async (context: RuntimeContext, options: ScrapeRepostsOptions): Promise<CliOutput> => {
  const startedAt = Date.now();
  const slug = profileSlug(options.url);
  const dir = await ensureOutputDirectory(context.cwd, join(options.outDir, makeRepostsRunFolder(slug)));
  const logger = createLogger(options);
  const session = await openBrowserSession(context, options.headful);
  try {
    const repostsUrl = buildRepostsUrl(options.url);
    logger.info(`navigating to reposts: ${repostsUrl}`);
    await session.page.goto(repostsUrl, { waitUntil: 'domcontentloaded' });
    if (await isLoginRequired(session.page)) throw new Error('Instagram session expired; run auth login first');
    await session.page.waitForTimeout(1500);
    await prepareProfileScreenshotVisuals(session.page);
    const endState = await scrollRepostsToEnd(session.page, logger);
    const write = (name: string, bytes: Uint8Array) => writeBinaryFile(dir, name, bytes);
    const screenshots = await captureRepostScreenshots(session.page, write, repostsUrl);
    const manifestPath = await writeJsonFile(dir, `${slug}-reposts.json`, { sourceUrl: options.url, repostsUrl, screenshots, screenshotCount: screenshots.length, repostLinks: endState.links, page: { width: endState.width, height: endState.height, viewportHeight: endState.viewportHeight, scrollY: endState.scrollY }, durationMs: Date.now() - startedAt });
    return { command: 'scrape.reposts', ok: true, summary: `captured ${screenshots.length} repost screenshots`, details: { manifestPath, screenshotCount: String(screenshots.length), repostsUrl } };
  } finally {
    await closeBrowserSession(session.browser);
  }
};
