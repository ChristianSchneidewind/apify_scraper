import type { CliOutput, RuntimeContext, ScrapeCommentsOptions, ScrapeLoopOptions } from '../../schemas/index.ts';
import {
  ensureOutputDirectory,
  writeJsonFile,
} from '../../adapters/filesystem/output.ts';
import { closeBrowserSession, openBrowserSession } from '../../adapters/playwright/browser.ts';
import { createLogger } from '../../core/logger.ts';
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
  const logger = createLogger(options);
  logger.info(`output dir: ${dir}`);
  logger.info('opening browser');
  const session = await openBrowserSession(context, options.headful);
  try {
    logger.info('navigating to post');
    await session.page.goto(options.url, { waitUntil: 'domcontentloaded' });
    logger.info('waiting for initial load');
    await session.page.waitForTimeout(1500);
    logger.info('loading comments');
    await prepareCommentsPage(session.page as never, options.maxUiRounds ?? 40, options.uiIdleRounds ?? 6);
    logger.info('capturing comments');

    const loopOptions: ScrapeLoopOptions = { outDir: dir, quiet: options.quiet, verbose: options.verbose };
    if (options.likerCollectionMode !== undefined) loopOptions.likerCollectionMode = options.likerCollectionMode;
    if (options.maxComments !== undefined) loopOptions.maxComments = options.maxComments;
    if (options.maxCommentLikers !== undefined) loopOptions.maxCommentLikers = options.maxCommentLikers;
    if (options.maxUiRounds !== undefined) loopOptions.maxUiRounds = options.maxUiRounds;
    if (options.uiIdleRounds !== undefined) loopOptions.uiIdleRounds = options.uiIdleRounds;
    logger.info('starting scrape loop');
    logger.debug('loop: entering');
    const comments = await runCommentScrapeLoop(session.page as never, loopOptions);
    logger.info(`scrape loop done: ${comments.length} comments`, { comments: comments.length });

    const jsonPath = await writeJsonFile(dir, 'comments.json', {
    comments,
    sourceUrl: options.url,
    });
    logger.info(`wrote ${jsonPath}`);
    return buildSuccess(
    comments.length,
    jsonPath,
    countScreenshots(comments),
    sumLikes(comments),
    sumLikers(comments),
    );
  } finally {
    await closeBrowserSession(session.browser);
  }
};
