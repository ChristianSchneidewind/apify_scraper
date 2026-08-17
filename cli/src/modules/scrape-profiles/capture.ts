import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ensureOutputDirectory,
  writeBinaryFile,
  writeJsonFile,
} from '../../adapters/filesystem/output.ts';
import { prepareProfileScreenshotVisuals } from '../../adapters/instagram/visual.ts';
import { makeScreenshotUtc, makeUuid7 } from '../scrape-comments/capture/screenshot-session.ts';
import type { ProfilePageData } from '../../schemas/index.ts';

const PROFILE_WAIT_MS = 3000;
const scriptPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'browser-scripts/extract-profile.script',
);
const EXTRACT_PROFILE_BROWSER_SCRIPT = readFileSync(scriptPath, 'utf8');
const PROFILE_BANNER_SCRIPT = readFileSync(join(dirname(scriptPath), 'set-profile-banner.script'), 'utf8');

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

const runExtractProfilePayload = (script: string) =>
  new Function(`return (${script})()`)() as Omit<ProfilePageData, 'sourceUrl'>;

export const extractProfilePageData = async (
  page: { evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T> },
  sourceUrl: string,
) => {
  const extracted = await page.evaluate(runExtractProfilePayload, EXTRACT_PROFILE_BROWSER_SCRIPT);
  return {
    ...extracted,
    sourceUrl,
    username: extracted.username || extractUsernameFromUrl(sourceUrl),
  };
};

export const captureProfilePage = async (
  page: {
    evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
    screenshot: (options: { fullPage: boolean }) => Promise<Uint8Array>;
    waitForTimeout: (ms: number) => Promise<void>;
  },
  sourceUrl: string,
) => {
  await prepareProfileScreenshotVisuals(page);
  await page.waitForTimeout(PROFILE_WAIT_MS);
  const profile = await extractProfilePageData(page, sourceUrl);
  const screenshotUuid = makeUuid7();
  await page.evaluate((args: { body: string; text: string }) => new Function(`return (${args.body})`)()({ text: args.text }), {
    body: PROFILE_BANNER_SCRIPT,
    text: `${sourceUrl}\n${makeScreenshotUtc()} | profile | ${screenshotUuid}`,
  });
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
