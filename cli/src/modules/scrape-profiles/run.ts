import type { CliOutput, RuntimeContext, ScrapeProfilesOptions } from '../../schemas/index.ts';
import { closeBrowserSession, openBrowserSession } from '../../adapters/playwright/browser.ts';
import {
  captureProfilePage,
  persistProfileArtifacts,
  resolveProfileSlug,
} from './capture.ts';

const buildSuccess = (jsonPath: string, screenshotPath: string): CliOutput => ({
  command: 'scrape.profiles',
  details: { jsonPath, screenshotPath },
  ok: true,
  summary: 'scraped profile artifacts',
});

export const runScrapeProfiles = async (
  context: RuntimeContext,
  options: ScrapeProfilesOptions,
) => {
  const session = await openBrowserSession(context, options.headful);
  try {
    await session.page.goto(options.url, { waitUntil: 'domcontentloaded' });
    const slug = resolveProfileSlug(options.url, options.profileSlug);
    const { profile, screenshot } = await captureProfilePage(session.page, options.url);
    const paths = await persistProfileArtifacts(
    context.cwd,
    options.outDir,
    slug,
    profile,
    screenshot,
    );
    return buildSuccess(paths.jsonPath, paths.screenshotPath);
  } finally {
    await closeBrowserSession(session.browser);
  }
};
