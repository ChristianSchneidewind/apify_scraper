import { join } from 'node:path';
import {
  ensureOutputDirectory,
  writeBinaryFile,
  writeJsonFile,
} from '../../adapters/filesystem/output.ts';
import { prepareProfileScreenshotVisuals } from '../../adapters/instagram/visual.ts';
import { makeScreenshotUtc, makeUuid7 } from '../scrape-comments/capture/screenshot-session.ts';
import type { ProfileCapturePage, ProfilePageData, ProfileReadPage } from '../../schemas/index.ts';
import { extractProfile, setProfileBanner } from './browser.ts';

const PROFILE_WAIT_MS = 3000;

const RESERVED_SEGMENTS = new Set([
  'accounts',
  'direct',
  'explore',
  'locations',
  'p',
  'reel',
  'reels',
  'stories',
]);

export const extractUsernameFromUrl = (url: string) => {
  const path = new URL(url).pathname.replace(/^\/+|\/+$/g, '');
  const segment = path.split('/').filter(Boolean)[0];
  if (!segment || RESERVED_SEGMENTS.has(segment)) {
    return null;
  }
  return segment;
};

export const resolveProfileSlug = (url: string, profileSlug?: string) =>
  profileSlug || extractUsernameFromUrl(url) || 'profile';

export const extractProfilePageData = async (
  page: ProfileReadPage,
  sourceUrl: string,
) => {
  const extracted = await page.evaluate(extractProfile, undefined);
  return {
    ...extracted,
    sourceUrl,
    username: extracted.username || extractUsernameFromUrl(sourceUrl),
  };
};

export const captureProfilePage = async (
  page: ProfileCapturePage,
  sourceUrl: string,
) => {
  await prepareProfileScreenshotVisuals(page);
  await page.waitForTimeout(PROFILE_WAIT_MS);
  const profile = await extractProfilePageData(page, sourceUrl);
  const screenshotUuid = makeUuid7();
  const banner = `${sourceUrl}\n${makeScreenshotUtc()} | profile | ${screenshotUuid}`;
  await page.evaluate(setProfileBanner, banner);
  const screenshot = await page.screenshot({ fullPage: true });
  return { profile, screenshot };
};

export const makeProfileRunFolder = (slug: string) => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const timestamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  return `${timestamp}_${slug}`;
};

export const persistProfileArtifacts = async (
  cwd: string,
  outDir: string,
  slug: string,
  profile: ProfilePageData,
  screenshot: Uint8Array,
) => {
  const dir = await ensureOutputDirectory(cwd, join(outDir, makeProfileRunFolder(slug)));
  const jsonPath = await writeJsonFile(dir, `${slug}.json`, profile);
  const screenshotPath = await writeBinaryFile(dir, `${slug}.png`, screenshot);
  return { jsonPath, screenshotPath };
};
