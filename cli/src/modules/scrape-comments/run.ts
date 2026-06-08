import type { CliOutput, RuntimeContext, ScrapeCommentsOptions } from '../../schemas/index.ts';
import {
  ensureOutputDirectory,
  writeBinaryFile,
  writeJsonFile,
} from '../../adapters/filesystem/output.ts';
import { closeBrowserSession, openBrowserSession } from '../../adapters/playwright/browser.ts';
import { runCommentScrapeLoop } from './scrape-loop.ts';

const buildSuccess = (
  count: number,
  jsonPath: string,
  screenshotPath: string,
): CliOutput => ({
  command: 'scrape.comments',
  details: { commentsCount: String(count), jsonPath, screenshotPath },
  ok: true,
  summary: `scraped ${count} comments`,
});

export const runScrapeComments = async (
  context: RuntimeContext,
  options: ScrapeCommentsOptions,
) => {
  const dir = await ensureOutputDirectory(context.cwd, options.outDir || 'artifacts/comments');
  const session = await openBrowserSession(context, options.headful);
  await session.page.goto(options.url, { waitUntil: 'domcontentloaded' });
  await session.page.waitForTimeout(1500);
  const loopOptions = options.maxComments === undefined
    ? {}
    : { maxComments: options.maxComments };
  const comments = await runCommentScrapeLoop(session.page, loopOptions);
  const screenshot = await session.page.screenshot({ fullPage: true });
  await closeBrowserSession(session.browser);
  const jsonPath = await writeJsonFile(dir, 'comments.json', {
    comments,
    sourceUrl: options.url,
  });
  const screenshotPath = await writeBinaryFile(dir, 'comments.png', screenshot);
  return buildSuccess(comments.length, jsonPath, screenshotPath);
};
