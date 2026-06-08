import type { CommentRecord } from '../../schemas/index.ts';
import { buildCommentKey } from './comment-key.ts';
import { extractCommentsFromTimes } from './extract-times.ts';
import { expandComments } from './ui-expand.ts';
import { getCommentContainer } from './ui-container.ts';
import { scrollCommentContainer } from './ui-scroll.ts';

const DEFAULT_MAX_UI_ROUNDS = 15;
const DEFAULT_UI_IDLE_ROUNDS = 4;

const appendIfNew = (
  item: CommentRecord,
  seen: Set<string>,
  comments: CommentRecord[],
) => {
  const key = buildCommentKey(item);
  if (seen.has(key)) return false;
  seen.add(key);
  comments.push(item);
  return true;
};

const trimToMax = (comments: CommentRecord[], maxComments: number) => {
  if (!maxComments || comments.length <= maxComments) return;
  comments.splice(maxComments);
};

const mergeBatch = (
  batch: CommentRecord[],
  seen: Set<string>,
  comments: CommentRecord[],
  maxComments: number,
) => {
  let newInRound = 0;
  for (const item of batch) {
    if (appendIfNew(item, seen, comments)) newInRound += 1;
  }
  trimToMax(comments, maxComments);
  return newInRound;
};

export const runCommentScrapeLoop = async (
  page: {
    evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
    waitForTimeout: (ms: number) => Promise<void>;
  },
  options: { maxComments?: number; maxUiRounds?: number; uiIdleRounds?: number },
) => {
  const maxComments = options.maxComments ?? 0;
  const maxUiRounds = options.maxUiRounds ?? DEFAULT_MAX_UI_ROUNDS;
  const uiIdleRounds = options.uiIdleRounds ?? DEFAULT_UI_IDLE_ROUNDS;
  const seen = new Set<string>();
  const comments: CommentRecord[] = [];
  let idle = 0;

  for (let round = 0; round < maxUiRounds; round += 1) {
    await expandComments(page);
    const container = await getCommentContainer(page);
    const batch = await extractCommentsFromTimes(page);
    const newInRound = mergeBatch(batch, seen, comments, maxComments);
    if (maxComments && comments.length >= maxComments) break;
    idle = newInRound === 0 ? idle + 1 : 0;
    if (idle >= uiIdleRounds) break;
    await scrollCommentContainer(page, container);
    await page.waitForTimeout(1200);
  }

  return comments;
};
