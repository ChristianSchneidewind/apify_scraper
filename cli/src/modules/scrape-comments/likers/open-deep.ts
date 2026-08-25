import type { CurrentLikesPage, DeepLinkPage, LikeClickArgs, LikeClickProbe, OpenLikesResult, ReplyClickArgs } from '../../../schemas/index.ts';

const LIKE_TEXT_PATTERNS = [
  '^\\s*\\d+[\\d.,]*\\s*likes?\\s*$',
  '^\\s*\\d+[\\d.,]*\\s*gefällt\\s*mir(?:-angaben|\\s*mal)?\\s*$',
  '^\\s*gefällt\\s+\\d+[\\d.,]*\\s*mal\\s*$',
];
const MAX_ATTEMPTS_PER_SCOPE = 6;

const readLikesCountFrom = (scope: Element) => {
  const text = (scope.textContent || '').replace(/\s+/g, ' ');
  const match = text.match(/(\d+[\d.,]*)\s*likes?/i)
    || text.match(/(\d+[\d.,]*)\s*gefällt\s*mir/i);
  return match ? Number.parseInt((match[1] || '').replace(/[.,]/g, ''), 10) || 0 : 0;
};

const likeControlsIn = (scope: Element, patterns: string[]) => {
  const regexes = patterns.map((pattern) => new RegExp(pattern, 'i'));
  const controls = Array.from(scope.querySelectorAll('button, a, [role="button"], [tabindex="0"]'));
  return controls.filter((el) => regexes.some((re) => re.test((el.textContent || '').trim())));
};

const clickLikeCandidateBrowser = (args: LikeClickArgs): LikeClickProbe => {
  const anchor = document.querySelector(`a[href="${args.permalink}"]`);
  if (!anchor) return { likesCount: 0, status: 'no_anchor' };
  let scope = anchor.closest('li, [role="listitem"], article, div') || anchor;
  for (let level = 1; level < args.breadth; level += 1) {
    if (scope.parentElement) scope = scope.parentElement;
  }
  const likesCount = readLikesCountFrom(scope);
  const target = likeControlsIn(scope, args.patterns)[args.attempt];
  if (!target) return { likesCount, status: 'no_candidate' };
  (target as HTMLElement).scrollIntoView({ block: 'center' });
  (target as HTMLElement).click();
  return { likesCount, status: 'clicked' };
};

const anchorExists = (page: CurrentLikesPage, commentPermalink: string) =>
  page.locator(`a[href="${commentPermalink}"]`).count();

const dialogOpen = (page: CurrentLikesPage) =>
  page.locator('[role="dialog"]').count();

const clickReplyAtBrowser = (args: ReplyClickArgs) => {
  const re = new RegExp(args.pattern, 'i');
  const controls = Array.from(document.querySelectorAll('button, [role="button"]'));
  const matches = controls.filter((el) => re.test((el.textContent || '').replace(/\s+/g, ' ').trim()));
  const target = matches[args.index];
  if (!target) return false;
  (target as HTMLElement).click();
  return true;
};

const REPLY_EXPAND_PATTERN = '(?:view|show|anzeigen|ansehen).*?(?:repl|antwort)|(?:repl|antwort).*?(?:view|show|anzeigen|ansehen)';

const expandDeepReplies = async (page: DeepLinkPage) => {
  for (let index = 0; index < 20; index += 1) {
    const clicked = await page.evaluate(clickReplyAtBrowser, { index, pattern: REPLY_EXPAND_PATTERN }).catch(() => false);
    if (!clicked) break;
    await page.waitForTimeout(250);
  }
};

const buildLikeArgs = (attempt: number, breadth: number, permalink: string): LikeClickArgs => ({
  attempt,
  breadth,
  patterns: LIKE_TEXT_PATTERNS,
  permalink,
});

const probeScope = async (
  page: CurrentLikesPage,
  commentPermalink: string,
  breadth: number,
  prefix: string,
): Promise<OpenLikesResult | null> => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_SCOPE; attempt += 1) {
    const probe = await page.evaluate(clickLikeCandidateBrowser, buildLikeArgs(attempt, breadth, commentPermalink));
    if (probe.status === 'no_candidate') return { clicked: false, likesCount: probe.likesCount ?? 0 };
    if (probe.status === 'no_anchor') return null;
    await page.waitForTimeout(350);
    if (await dialogOpen(page)) return { clicked: true, likesCount: probe.likesCount, reason: `${prefix}_${attempt}` };
  }
  return { clicked: false, likesCount: 0 };
};

const probeScopes = async (
  page: CurrentLikesPage,
  commentPermalink: string,
  prefix: string,
): Promise<OpenLikesResult | null> => {
  let likesCount = 0;
  for (const breadth of [1, 6]) {
    const probe = await probeScope(page, commentPermalink, breadth, prefix);
    if (!probe) return null;
    if (probe.clicked) return probe;
    likesCount = Math.max(likesCount, probe.likesCount ?? 0);
  }
  return { clicked: false, likesCount };
};

const debugLikeScopeBrowser = (permalink: string) => {
  const anchor = document.querySelector(`a[href="${permalink}"]`);
  const scope = anchor?.closest('li, [role="listitem"], article, div') || anchor;
  const controls = scope ? Array.from(scope.querySelectorAll('button, a, [role="button"], [tabindex="0"]')) : [];
  return {
    controls: controls.slice(0, 20).map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120)),
    scopeText: (scope?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240),
  };
};

const logDebugScope = async (page: CurrentLikesPage, commentPermalink: string, tag: string) => {
  const debug = await page.evaluate(debugLikeScopeBrowser, commentPermalink).catch(() => null);
  if (debug) process.stderr.write(`[scrape.comments][likers][debug] ${tag} ${JSON.stringify(debug)}\n`);
};

export const clickLikesInCurrentPage = async (
  page: CurrentLikesPage,
  commentPermalink: string,
  verbose?: boolean,
) => {
  if (await anchorExists(page, commentPermalink) === 0) {
    return { clicked: false, likesCount: 0, reason: 'current_target_comment_not_found' };
  }
  const hit = await probeScopes(page, commentPermalink, 'cdp_text_click');
  if (hit?.clicked) return hit;
  if (verbose) await logDebugScope(page, commentPermalink, 'current');
  return { clicked: false, likesCount: hit?.likesCount ?? 0, reason: 'current_no_like_in_target_comment' };
};

export const openLikesDeepLink = async (
  page: DeepLinkPage,
  commentUrl: string,
  commentPermalink: string,
  verbose?: boolean,
) => {
  await page.goto(commentUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  if (await anchorExists(page, commentPermalink) === 0) {
    await expandDeepReplies(page);
  }
  if (await anchorExists(page, commentPermalink) === 0) {
    return { clicked: false, likesCount: 0, reason: 'deep_target_comment_not_found' };
  }
  const hit = await probeScopes(page, commentPermalink, 'cdp_text_click');
  if (hit?.clicked) return hit;
  if (verbose) await logDebugScope(page, commentPermalink, 'deep');
  return { clicked: false, likesCount: hit?.likesCount ?? 0, reason: 'deep_no_like_in_target_comment' };
};
