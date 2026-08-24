import type { CliOutput, RuntimeContext, ScrapeProfilesOptions } from '../../schemas/index.ts';
import { isLoginRequired } from '../../adapters/instagram/auth.ts';
import { closeBrowserSession, openBrowserSession } from '../../adapters/playwright/browser.ts';
import {
  captureProfilePage,
  persistProfileArtifacts,
  resolveProfileSlug,
} from './capture.ts';

const buildSuccess = (jsonPath: string, screenshotPath: string, durationMs: number): CliOutput => ({
  command: 'scrape.profiles',
  details: { jsonPath, screenshotPath, durationMs: String(durationMs) },
  ok: true,
  summary: 'scraped profile artifacts',
});

export const runScrapeProfiles = async (
  context: RuntimeContext,
  options: ScrapeProfilesOptions,
) => {
  const startedAt = Date.now();
  const session = await openBrowserSession(context, options.headful);
  try {
    await session.page.goto(options.url, { waitUntil: 'domcontentloaded' });
    if (await isLoginRequired(session.page)) {
    throw new Error('Instagram session expired; run auth login first');
    }
    const slug = resolveProfileSlug(options.url, options.profileSlug);
    const { profile, screenshot } = await captureProfilePage(session.page, options.url);
    const paths = await persistProfileArtifacts(
    context.cwd,
    options.outDir,
    slug,
    profile,
    screenshot,
    );
    return buildSuccess(paths.jsonPath, paths.screenshotPath, Date.now() - startedAt);
  } finally {
    await closeBrowserSession(session.browser);
  }
};
