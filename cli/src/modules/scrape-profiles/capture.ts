import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ensureOutputDirectory,
  writeBinaryFile,
  writeJsonFile,
} from '../../adapters/filesystem/output.ts';
import { prepareProfileScreenshotVisuals } from '../../adapters/instagram/visual.ts';
import type { ProfilePageData } from '../../schemas/index.ts';

const PROFILE_WAIT_MS = 3000;
const scriptPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'browser-scripts/extract-profile.script',
);
const EXTRACT_PROFILE_BROWSER_SCRIPT = readFileSync(scriptPath, 'utf8');

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
  const screenshot = await page.screenshot({ fullPage: true });
  return { profile, screenshot };
};

export const persistProfileArtifacts = async (
  cwd: string,
  outDir: string,
  slug: string,
  profile: ProfilePageData,
  screenshot: Uint8Array,
) => {
  const dir = await ensureOutputDirectory(cwd, outDir);
  const jsonPath = await writeJsonFile(dir, `${slug}.json`, profile);
  const screenshotPath = await writeBinaryFile(dir, `${slug}.png`, screenshot);
  return { jsonPath, screenshotPath };
};
