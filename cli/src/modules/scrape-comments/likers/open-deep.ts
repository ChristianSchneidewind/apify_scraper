import type { ClickableLocator, DeepLinkPage, DeepLocator, FilterLocator } from '../../../schemas/index.ts';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const READ_LIKES_SCRIPT = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'browser-scripts/read-likes-count.script'),
  'utf8',
);

const tryClick = async (page: DeepLinkPage, cand: ClickableLocator, tag: string) => {
  const scrolled = await Promise.allSettled([
    cand.scrollIntoViewIfNeeded({ timeout: 2500 }),
  ]);
  if (scrolled[0]?.status !== 'fulfilled') return null;
  const clicked = await Promise.allSettled([
    cand.click({ timeout: 3000 }),
  ]);
  if (clicked[0]?.status !== 'fulfilled') return null;
  await page.waitForTimeout(350);
  return await page.locator('[role="dialog"]').count()
    ? { clicked: true, reason: tag }
    : null;
};

const clickNth = async (
  page: DeepLinkPage,
  loc: FilterLocator,
  index: number,
  tag: string,
) => tryClick(page, loc.nth(index), tag);

const scanLocator = async (
  page: DeepLinkPage,
  loc: FilterLocator,
  prefix: string,
) => {
  const cnt = await loc.count();
  let i = 0;
  while (i < Math.min(cnt, 6)) {
    const hit = await clickNth(page, loc, i, `${prefix}_${i}`);
    if (hit) return hit;
    i += 1;
  }
  return null;
};

const scanLikeTargets = async (
  page: DeepLinkPage,
  scope: FilterLocator | DeepLocator,
  likesCount: number,
) => {
  const textLoc = scope.locator('button, a, [role="button"], [tabindex="0"]').filter({ hasText: /^\s*\d+[\d.,]*\s*likes?\s*$/i });
  const textHit = await scanLocator(page, textLoc, 'pw_text_click');
  if (textHit) return { ...textHit, likesCount };

  const deLoc = scope.locator('button, a, [role="button"], [tabindex="0"]').filter({
    hasText: /^\s*\d+[\d.,]*\s*gefällt\s*mir(?:-angaben|\s*mal)?\s*$/i,
  });
  const deHit = await scanLocator(page, deLoc, 'pw_text_click');
  if (deHit) return { ...deHit, likesCount };

  const dePrefixLoc = scope.locator('button, a, [role="button"], [tabindex="0"]').filter({
    hasText: /^\s*gefällt\s+\d+[\d.,]*\s*mal\s*$/i,
  });
  const dePrefixHit = await scanLocator(page, dePrefixLoc, 'pw_text_click');
  if (dePrefixHit) return { ...dePrefixHit, likesCount };

  return null;
};

const debugLikeScope = async (anchor: DeepLocator) => anchor.evaluate((el: Element) => {
  const scope = el?.closest?.('li, [role="listitem"], article, div') || el;
  const broad = [] as Element[];
  let current: Element | null = scope;
  for (let i = 0; i < 6 && current; i += 1) {
    broad.push(current);
    current = current.parentElement;
  }
  const controls = broad.flatMap((node) => Array.from(node.querySelectorAll?.('button, a, [role="button"], [tabindex="0"]') || []));
  return {
    scopeText: (scope?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240),
    controls: controls.slice(0, 20).map((node) => ({ aria: (node.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 120), role: node.getAttribute('role') || '', tag: node.tagName, text: (node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120), title: (node.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 120) })),
  };
}, undefined as never);

function runElementBody<T>(el: Element, args: { body: string }) {
  return new Function('el', args.body)(el) as T;
}

const firstLocator = (locator: { first: DeepLocator | (() => DeepLocator) }) =>
  typeof locator.first === 'function' ? locator.first() : locator.first;

const expandDeepReplies = async (page: DeepLinkPage) => {
  const base = page.locator('button, [role="button"]') as unknown as Partial<FilterLocator>;
  if (!base.filter) return;
  const controls = base.filter({
    hasText: /(?:view|show|anzeigen|ansehen).*?(?:repl|antwort)|(?:repl|antwort).*?(?:view|show|anzeigen|ansehen)/i,
  });
  const count = Math.min(await controls.count(), 20);
  for (let index = 0; index < count; index += 1) {
    await controls.nth(index).click({ timeout: 2000 }).catch(() => undefined);
    await page.waitForTimeout(250);
  }
};

export const clickLikesInCurrentPage = async (
  page: { locator: DeepLinkPage['locator']; waitForTimeout: DeepLinkPage['waitForTimeout'] },
  commentPermalink: string,
  verbose?: boolean,
) => {
  const anchor = firstLocator(page.locator(`a[href="${commentPermalink}"]`));
  if (await anchor.count() === 0) {
    return { clicked: false, likesCount: 0, reason: 'current_target_comment_not_found' };
  }

  const likesCount = await anchor.evaluate(
    runElementBody<number>,
    { body: READ_LIKES_SCRIPT },
  );

  const scope = anchor.locator('xpath=ancestor-or-self::*[self::li or @role="listitem" or self::article or self::div][1]');
  const broadScope = anchor.locator('xpath=ancestor-or-self::*[self::li or @role="listitem" or self::article or self::div][position() <= 6]');
  const directHit = await scanLikeTargets(page as DeepLinkPage, scope, likesCount);
  if (directHit) return directHit;
  const broadHit = await scanLikeTargets(page as DeepLinkPage, broadScope, likesCount);
  if (broadHit) return { ...broadHit, reason: `broad_${broadHit.reason}` };
  if (verbose) {
    const dbg = await debugLikeScope(anchor).catch(() => null);
    if (dbg) process.stderr.write(`[scrape.comments][likers][debug] current scopeText=${JSON.stringify(dbg.scopeText)} controls=${JSON.stringify(dbg.controls)}\n`);
  }

  return { clicked: false, likesCount, reason: 'current_no_like_in_target_comment' };
};

export const openLikesDeepLink = async (
  page: DeepLinkPage,
  commentUrl: string,
  commentPermalink: string,
  verbose?: boolean,
) => {
  await page.goto(commentUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);

  let anchor = firstLocator(page.locator(`a[href="${commentPermalink}"]`));
  if (await anchor.count() === 0) {
    await expandDeepReplies(page);
    anchor = firstLocator(page.locator(`a[href="${commentPermalink}"]`));
  }
  if (await anchor.count() === 0) return { clicked: false, likesCount: 0, reason: 'deep_target_comment_not_found' };

  const likesCount = await anchor.evaluate(
    runElementBody<number>,
    { body: READ_LIKES_SCRIPT },
  );

  const scope = anchor.locator('xpath=ancestor-or-self::*[self::li or @role="listitem" or self::article or self::div][1]');
  const broadScope = anchor.locator('xpath=ancestor-or-self::*[self::li or @role="listitem" or self::article or self::div][position() <= 6]');
  const hit = await scanLikeTargets(page, scope, likesCount);
  if (hit) return hit;
  const broadHit = await scanLikeTargets(page, broadScope, likesCount);
  if (broadHit) return { ...broadHit, reason: `broad_${broadHit.reason}` };
  if (verbose) {
    const dbg = await debugLikeScope(anchor).catch(() => null);
    if (dbg) process.stderr.write(`[scrape.comments][likers][debug] deep scopeText=${JSON.stringify(dbg.scopeText)} controls=${JSON.stringify(dbg.controls)}\n`);
  }

  return { clicked: false, likesCount, reason: 'deep_no_like_in_target_comment' };
};
