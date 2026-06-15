import type { CliOutput, RuntimeContext, ScrapeCommentsOptions, ScrapeLoopOptions } from '../../schemas/index.ts';
import {
  ensureOutputDirectory,
  writeJsonFile,
} from '../../adapters/filesystem/output.ts';
import { closeBrowserSession, openBrowserSession } from '../../adapters/playwright/browser.ts';
import { prepareCommentsPage } from './page-setup.ts';
import { runCommentScrapeLoop } from './scrape-loop.ts';

const buildSuccess = (
  count: number,
  jsonPath: string,
  screenshotCount: number,
  likesCount: number,
  likersCount: number,
): CliOutput => ({
  command: 'scrape.comments',
  details: {
    commentsCount: String(count),
    jsonPath,
    likersCount: String(likersCount),
    likesCount: String(likesCount),
    screenshotCount: String(screenshotCount),
  },
  ok: true,
  summary: `scraped ${count} comments`,
});

const countScreenshots = (comments: Array<{ screenshotPaths?: string[] }>) =>
  comments.reduce((sum, item) => sum + (item.screenshotPaths?.length || 0), 0);

const sumLikes = (comments: Array<{ likesCount?: number }>) =>
  comments.reduce((sum, item) => sum + (Number(item.likesCount) || 0), 0);

const sumLikers = (comments: Array<{ commentLikers?: Array<unknown> }>) =>
  comments.reduce((sum, item) => sum + (item.commentLikers?.length || 0), 0);

const logStage = (message: string) => {
  process.stderr.write(`[scrape.comments] ${message}\n`);
};

const writeStage = (options: ScrapeCommentsOptions, stage: string) => {
  if (options.quiet) return;
  process.stderr.write(`[scrape.comments] ${stage}\n`);
};

const makeRunFolder = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
};

export const runScrapeComments = async (
  context: RuntimeContext,
  options: ScrapeCommentsOptions,
) => {
  const dir = await ensureOutputDirectory(context.cwd, `${options.outDir || 'artifacts/comments'}/${makeRunFolder()}`);
  writeStage(options, `output dir: ${dir}`);
  writeStage(options, 'opening browser');
  const session = await openBrowserSession(context, options.headful);
  writeStage(options, 'navigating to post');
  await session.page.goto(options.url, { waitUntil: 'domcontentloaded' });
  writeStage(options, 'waiting for initial load');
  await session.page.waitForTimeout(1500);
  writeStage(options, 'loading comments');
  await prepareCommentsPage(session.page as never, options.maxUiRounds ?? 40, options.uiIdleRounds ?? 6);
  writeStage(options, 'capturing comments');

  const loopOptions: ScrapeLoopOptions = { outDir: dir, quiet: options.quiet, verbose: options.verbose };
  if (options.likerCollectionMode !== undefined) loopOptions.likerCollectionMode = options.likerCollectionMode;
  if (options.maxComments !== undefined) loopOptions.maxComments = options.maxComments;
  if (options.maxCommentLikers !== undefined) loopOptions.maxCommentLikers = options.maxCommentLikers;
  if (options.maxUiRounds !== undefined) loopOptions.maxUiRounds = options.maxUiRounds;
  if (options.uiIdleRounds !== undefined) loopOptions.uiIdleRounds = options.uiIdleRounds;
  writeStage(options, 'starting scrape loop');
  logStage('loop: entering');
  const comments = await runCommentScrapeLoop(session.page as never, loopOptions);
  writeStage(options, `scrape loop done: ${comments.length} comments`);
  await closeBrowserSession(session.browser);

  const jsonPath = await writeJsonFile(dir, 'comments.json', {
    comments,
    sourceUrl: options.url,
  });
  writeStage(options, `wrote ${jsonPath}`);
  return buildSuccess(
    comments.length,
    jsonPath,
    countScreenshots(comments),
    sumLikes(comments),
    sumLikers(comments),
  );
};
