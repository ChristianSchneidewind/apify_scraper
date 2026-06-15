import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LikersBatch } from '../../../schemas/index.ts';

const COLLECT_SCRIPT = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'browser-scripts/collect-likers-dialog.script'),
  'utf8',
);

const DIALOG_OPEN_SCRIPT = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'browser-scripts/dialog-is-open.script'),
  'utf8',
);

const mergeBatch = (
  batch: LikersBatch,
  seen: Set<string>,
  likers: Array<{ profileUrl: string; username: string }>,
  maxCommentLikers: number,
) => {
  let added = 0;
  for (const item of batch.items || []) {
    const u = (item.username || '').trim();
    const p = (item.profilePath || '').trim();
    if (!u || !p) continue;
    const key = u.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const profileUrl = p.startsWith('http') ? p : `https://www.instagram.com${p}`;
    likers.push({ profileUrl, username: u });
    added += 1;
    if (maxCommentLikers && likers.length >= maxCommentLikers) break;
  }
  return added;
};

function runIifeBody<T>(args: { body: string }) {
  const source = args.body.trim().replace(/^return\s+/, '').replace(/;\s*$/, '');
  return new Function(`return ${source}`)() as T;
}

export const collectLikersFromDialog = async (
  page: {
    evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
    waitForTimeout: (ms: number) => Promise<void>;
  },
  maxCommentLikers: number,
) => {
  const likers: Array<{ profileUrl: string; username: string }> = [];
  const seen = new Set<string>();
  const maxRounds = maxCommentLikers === 0 ? 240 : 60;
  const maxStagnant = maxCommentLikers === 0 ? 8 : 3;
  let stagnant = 0;

  for (let round = 0; round < maxRounds; round += 1) {
    const batch = await page.evaluate(runIifeBody<LikersBatch>, { body: COLLECT_SCRIPT });
    if (!(batch as LikersBatch)?.open) break;
    const added = mergeBatch(batch as LikersBatch, seen, likers, maxCommentLikers);
    if (maxCommentLikers && likers.length >= maxCommentLikers) break;
    stagnant = added === 0 ? stagnant + 1 : 0;
    if (!(batch as LikersBatch).canScroll && stagnant >= maxStagnant) break;
    await page.waitForTimeout(maxCommentLikers === 0 ? 280 : 220);
  }
  return likers;
};

export const waitForDialogOpen = async (
  page: {
    evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
    waitForTimeout: (ms: number) => Promise<void>;
  },
) => {
  for (let i = 0; i < 20; i += 1) {
    const open = await page.evaluate(runIifeBody<boolean>, { body: DIALOG_OPEN_SCRIPT });
    if (open) return true;
    await page.waitForTimeout(180);
  }
  return false;
};
