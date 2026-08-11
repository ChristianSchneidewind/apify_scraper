import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Value } from '@sinclair/typebox/value';
import type { CliOutput, CommentRecord, RuntimeContext, ScrapeCommentsOptions, ScrapeLoopOptions } from '../../schemas/index.ts';
import { commentRecordSchema } from '../../schemas/index.ts';
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

const loadCheckpoint = async (path: string): Promise<CommentRecord[] | null> => {
  try {
    const raw = JSON.parse(await readFile(path, 'utf8')) as { comments?: unknown };
    if (!Array.isArray(raw.comments)) return null;
    return raw.comments.filter((item): item is CommentRecord => Value.Check(commentRecordSchema, item));
  } catch {
    return null;
  }
};

const prepareOutput = async (context: RuntimeContext, options: ScrapeCommentsOptions) => {
  const checkpointPath = options.resume ? resolve(context.cwd, options.resume) : null;
  const initialComments = checkpointPath ? await loadCheckpoint(checkpointPath) : [];
  if (options.resume && !initialComments) throw new Error('resume checkpoint could not be read');
  const outputPath = checkpointPath ? dirname(checkpointPath) : `${options.outDir || 'artifacts/comments'}/${makeRunFolder()}`;
  const dir = await ensureOutputDirectory(context.cwd, outputPath);
  return { dir, initialComments: initialComments || [] };
};

const buildLoopOptions = (
  options: ScrapeCommentsOptions,
  dir: string,
  initialComments: CommentRecord[],
): ScrapeLoopOptions => ({
  initialComments,
  outDir: dir,
  quiet: options.quiet,
  sourceUrl: options.url,
  verbose: options.verbose,
  ...(options.likerCollectionMode ? { likerCollectionMode: options.likerCollectionMode } : {}),
  ...(options.maxComments !== undefined ? { maxComments: options.maxComments } : {}),
  ...(options.maxCommentLikers !== undefined ? { maxCommentLikers: options.maxCommentLikers } : {}),
  ...(options.maxUiRounds !== undefined ? { maxUiRounds: options.maxUiRounds } : {}),
  ...(options.uiIdleRounds !== undefined ? { uiIdleRounds: options.uiIdleRounds } : {}),
});

export const runScrapeComments = async (
  context: RuntimeContext,
  options: ScrapeCommentsOptions,
) => {
  const { dir, initialComments } = await prepareOutput(context, options);
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

    const loopOptions = buildLoopOptions(options, dir, initialComments);
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
