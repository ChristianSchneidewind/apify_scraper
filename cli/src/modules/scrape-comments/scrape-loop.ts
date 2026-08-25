import type { CheckpointProcessOptions, CommentRecord, LikersPage, ProcessOptions, ProcessState, ScrapeLoopOptions } from '../../schemas/index.ts';
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

const withoutLikerProfiles = (comment: CommentRecord): CommentRecord => ({
  ...comment,
  commentLikers: [],
  likersComplete: false,
  likersReason: 'liker_collection_disabled',
});

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

const persistCandidate = async (
  item: CommentRecord | null,
  comments: CommentRecord[],
  maxComments: number,
  processOpts: CheckpointProcessOptions,
) => {
  if (!item) return 'none';
  const previousCount = comments.length;
  upsertComment(comments, item);
  await saveCheckpoint(processOpts.outDir, comments, processOpts.sourceUrl);
  if (maxComments && comments.length >= maxComments) return 'max';
  return comments.length > previousCount ? 'refresh' : 'saved';
};

const buildProcessState = () => ({
  count: 0,
  lastScreenshotHash: null as string | null,
  newInRound: 0,
  needsLocatorRefresh: false,
  seenLoose: new Set<string>(),
  seenPermalink: new Set<string>(),
  seenStrict: new Set<string>(),
  seenUid: new Set<string>(),
});

const logRound = (round: number, maxUiRounds: number, stage: string, quiet?: boolean) => {
  if (quiet) return;
  process.stderr.write(`[scrape.comments] round ${round}/${maxUiRounds}: ${stage}\n`);
};

const consumeLocatorRefresh = (state: ProcessState) => {
  const refresh = Boolean(state.needsLocatorRefresh);
  state.needsLocatorRefresh = false;
  return refresh;
};

const processRound = async (
  page: LikersPage,
  round: number,
  maxUiRounds: number,
  state: ProcessState,
  comments: CommentRecord[],
  maxComments: number,
  processOpts: ProcessOptions,
  passLabel = 'top-level',
) => {
  state.newInRound = 0;
  const rowLocators = (await listCommentRowLocators(page)) || [];
  const fallbackLocators = (await listTimeLocators(page)) || [];
  const locators = rowLocators.length ? [...rowLocators, ...fallbackLocators] : fallbackLocators;
  logRound(round, maxUiRounds, `${passLabel} locators ${locators.length}`, processOpts.quiet);
  for (const locator of locators) {
    const item = await processCommentCandidate(page, locator, state, processOpts);
    if (!item && consumeLocatorRefresh(state)) return processRound(page, round, maxUiRounds, state, comments, maxComments, processOpts, passLabel);
    const action = await persistCandidate(item, comments, maxComments, processOpts);
    if (action === 'max') return true;
    // A capture can re-render Reel rows. Refresh only after a newly added item.
    if (action === 'refresh') return processRound(page, round, maxUiRounds, state, comments, maxComments, processOpts, passLabel);
    if (maxComments && comments.length >= maxComments) return true;
  }
  logRound(round, maxUiRounds, `${passLabel} collected ${state.newInRound}, total ${comments.length}`, processOpts.quiet);
  return false;
};

const maybeRescanComments = async (
  page: LikersPage,
  needsRescan: boolean,
) => {
  if (!needsRescan) return;
  await rescanComments(page).catch(() => undefined);
  await Promise.resolve(page.waitForTimeout?.(1000)).catch(() => undefined);
};

const runPass = async (
  page: LikersPage,
  options: ScrapeLoopOptions,
  state: ProcessState,
  comments: CommentRecord[],
  processOpts: ProcessOptions,
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
    await openCommentsPanel(page).catch(() => undefined);
    if (expandCommentsClicks > 0) await expandComments(page, expandCommentsClicks).catch(() => 0);
    if (expandRepliesClicks > 0) await expandAllReplyThreads(page, expandRepliesClicks).catch(() => 0);

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
  page: LikersPage,
  options: ScrapeLoopOptions,
) => {
  const comments = (options.initialComments || []).map(withoutLikerProfiles);
  const state = buildProcessState();
  for (const comment of comments) {
    const identity = buildCommentIdentity(comment);
    registerCommentSeen(state, identity.strictKey, identity.looseKey, identity.permalink || null, null);
  }
  const processOpts: ProcessOptions = {
    maxCommentLikers: 0,
    outDir: options.outDir,
    ...(options.sourceUrl ? { sourceUrl: options.sourceUrl } : {}),
  };
  if (options.quiet !== undefined) processOpts.quiet = options.quiet;
  if (options.verbose !== undefined) processOpts.verbose = options.verbose;

  // Page setup has already loaded comments and expanded reply threads. Do not
  // mutate that UI while extraction and screenshots are in progress.
  const doneTopLevel = await runPass(page, options, state, comments, processOpts, 'top-level', 0, 0, undefined, 2);
  if (doneTopLevel) return comments;

  await resetCommentsToTop(page).catch(() => undefined);
  await Promise.resolve(page.waitForTimeout?.(1500)).catch(() => undefined);

  await runPass(page, options, state, comments, processOpts, 'rescan', 0, 0, 2, 2);
  return comments;
};
