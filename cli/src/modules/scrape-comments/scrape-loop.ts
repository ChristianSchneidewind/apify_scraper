import type { CommentRecord, LikersPage, ScrapeLoopOptions } from '../../schemas/index.ts';
import { writeJsonFile } from '../../adapters/filesystem/output.ts';
import { listCommentRowLocators, listTimeLocators } from './extract-from-locator.ts';
import { processCommentCandidate } from './process-comment.ts';
import { getCommentContainer } from './ui-container.ts';
import { openCommentsPanel } from './page-setup.ts';
import { expandAllReplyThreads, expandComments } from './ui-expand.ts';
import { rescanComments, resetCommentsToTop } from './ui-rescan.ts';
import { scrollCommentContainer } from './ui-scroll.ts';
import { buildCommentIdentity, registerCommentSeen } from './comment-state.ts';

const DEFAULT_MAX_UI_ROUNDS = 40;
const DEFAULT_UI_IDLE_ROUNDS = 6;

const saveCheckpoint = async (outDir: string, comments: CommentRecord[], sourceUrl?: string) => {
  await writeJsonFile(outDir, 'checkpoint.json', { comments, sourceUrl: sourceUrl || '' }).catch(() => undefined);
};

const hasIncompleteLikers = (comment: CommentRecord) =>
  (comment.likesCount || 0) > 0 && (comment.commentLikers || []).length === 0;

const upsertComment = (comments: CommentRecord[], item: CommentRecord) => {
  const identity = buildCommentIdentity(item);
  const index = comments.findIndex((existing) => {
    const current = buildCommentIdentity(existing);
    return identity.permalink
    ? current.permalink === identity.permalink
    : current.strictKey === identity.strictKey;
  });
  if (index >= 0) comments[index] = item;
  else comments.push(item);
};

const buildProcessState = () => ({
  count: 0,
  lastScreenshotHash: null as string | null,
  newInRound: 0,
  seenLoose: new Set<string>(),
  seenPermalink: new Set<string>(),
  seenStrict: new Set<string>(),
  seenUid: new Set<string>(),
});

const logRound = (round: number, maxUiRounds: number, stage: string, quiet?: boolean) => {
  if (quiet) return;
  process.stderr.write(`[scrape.comments] round ${round}/${maxUiRounds}: ${stage}\n`);
};

const processRound = async (
  page: LikersPage,
  round: number,
  maxUiRounds: number,
  state: ReturnType<typeof buildProcessState>,
  comments: CommentRecord[],
  maxComments: number,
  processOpts: { likerCollectionMode?: 'best_effort' | 'strict'; maxCommentLikers: number; outDir: string; quiet?: boolean; retryIncompleteLikers?: boolean; sourceUrl?: string; verbose?: boolean },
  passLabel = 'top-level',
) => {
  state.newInRound = 0;
  const commentPage = page as unknown as Parameters<typeof listCommentRowLocators>[0];
  const rowLocators = (await listCommentRowLocators(commentPage)) || [];
  const fallbackLocators = (await listTimeLocators(commentPage)) || [];
  const locators = rowLocators.length ? [...rowLocators, ...fallbackLocators] : fallbackLocators;
  logRound(round, maxUiRounds, `${passLabel} locators ${locators.length}`, processOpts.quiet);
  for (const locator of locators) {
    const item = await processCommentCandidate(page, locator, state, processOpts);
    if (item) {
    upsertComment(comments, item);
    await saveCheckpoint(processOpts.outDir, comments, processOpts.sourceUrl);
    }
    if (maxComments && comments.length >= maxComments) return true;
  }
  logRound(round, maxUiRounds, `${passLabel} collected ${state.newInRound}, total ${comments.length}`, processOpts.quiet);
  return false;
};

const maybeRescanComments = async (
  page: Parameters<typeof listTimeLocators>[0] & LikersPage,
  needsRescan: boolean,
) => {
  if (!needsRescan) return;
  await rescanComments(page as never).catch(() => undefined);
  await Promise.resolve(page.waitForTimeout?.(1000)).catch(() => undefined);
};

const runPass = async (
  page: Parameters<typeof listTimeLocators>[0] & LikersPage,
  options: ScrapeLoopOptions,
  state: ReturnType<typeof buildProcessState>,
  comments: CommentRecord[],
  processOpts: { likerCollectionMode?: 'best_effort' | 'strict'; maxCommentLikers: number; outDir: string; quiet?: boolean; retryIncompleteLikers?: boolean; sourceUrl?: string; verbose?: boolean },
  passLabel: string,
  expandCommentsClicks: number,
  expandRepliesClicks: number,
  roundLimit?: number,
  idleLimit?: number,
) => {
  const maxComments = options.maxComments ?? 0;
  const maxUiRounds = roundLimit ?? options.maxUiRounds ?? DEFAULT_MAX_UI_ROUNDS;
  const uiIdleRounds = idleLimit ?? options.uiIdleRounds ?? DEFAULT_UI_IDLE_ROUNDS;
  let idleRounds = 0;

  for (let round = 0; round < maxUiRounds; round += 1) {
    await openCommentsPanel(page as never).catch(() => undefined);
    if (expandCommentsClicks > 0) await expandComments(page as never, expandCommentsClicks).catch(() => 0);
    if (expandRepliesClicks > 0) await expandAllReplyThreads(page as never, expandRepliesClicks).catch(() => 0);

    if (await processRound(page, round + 1, maxUiRounds, state, comments, maxComments, processOpts, passLabel)) return true;

    const container = await Promise.resolve(getCommentContainer(page)).catch(() => null);
    const scrolled = await Promise.resolve(scrollCommentContainer(page, container, 5)).catch(() => false);
    const needsRescan = !scrolled || state.newInRound === 0;
    await maybeRescanComments(page, needsRescan);

    idleRounds = state.newInRound > 0 ? 0 : idleRounds + 1;
    logRound(round + 1, maxUiRounds, `${passLabel} idle ${idleRounds}/${uiIdleRounds}`, processOpts.quiet);
    if (idleRounds >= uiIdleRounds) break;
  }
  return false;
};

export const runCommentScrapeLoop = async (
  page: Parameters<typeof listTimeLocators>[0] & LikersPage,
  options: ScrapeLoopOptions,
) => {
  const comments: CommentRecord[] = [...(options.initialComments || [])];
  const state = buildProcessState();
  const seedComments = options.retryIncompleteLikers
    ? comments.filter((comment) => !hasIncompleteLikers(comment))
    : comments;
  for (const comment of seedComments) {
    const identity = buildCommentIdentity(comment);
    registerCommentSeen(state, identity.strictKey, identity.looseKey, identity.permalink || null, null);
  }
  const processOpts: { likerCollectionMode?: 'best_effort' | 'strict'; maxCommentLikers: number; outDir: string; quiet?: boolean; retryIncompleteLikers?: boolean; sourceUrl?: string; verbose?: boolean } = {
    maxCommentLikers: options.maxCommentLikers ?? 0,
    outDir: options.outDir,
    ...(options.retryIncompleteLikers ? { retryIncompleteLikers: true } : {}),
    ...(options.sourceUrl ? { sourceUrl: options.sourceUrl } : {}),
  };
  if (options.likerCollectionMode !== undefined) processOpts.likerCollectionMode = options.likerCollectionMode;
  if (options.quiet !== undefined) processOpts.quiet = options.quiet;
  if (options.verbose !== undefined) processOpts.verbose = options.verbose;

  const doneTopLevel = await runPass(page, options, state, comments, processOpts, 'top-level', 20, 0, undefined, 2);
  if (doneTopLevel) return comments;

  await resetCommentsToTop(page as never).catch(() => undefined);
  await Promise.resolve(page.waitForTimeout?.(1500)).catch(() => undefined);

  await runPass(page, options, state, comments, processOpts, 'replies', 40, 100, 2, 2);
  return comments;
};
