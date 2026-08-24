import type { CommentRecord, RefindCommentPayload } from '../../schemas/index.ts';

export const extractCommentBrowser = (
  element: Element,
  fromTime: boolean,
): CommentRecord | null => {
  let row: Element | null = fromTime ? element.parentElement : element;
  for (let depth = 0; depth < 24 && row; depth += 1) {
    const isReserved = /^\/(p|reels?|explore|accounts|direct|stories|locations)\//;
    const isUserLink = (link: HTMLAnchorElement) => /^\/[A-Za-z0-9._]+\/?$/.test(link.getAttribute('href') || '') && !isReserved.test(link.getAttribute('href') || '') && Boolean((link.textContent || '').trim());
    const user = Array.from(row.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')).find(isUserLink);
    const rawUsername = (user?.textContent || '').trim().replace(/\s+/g, '');
    const username = rawUsername.replace(/(?:verified|verifiziert)$/i, '');
    const profileSlug = (user?.getAttribute('href') || '').replaceAll('/', '').toLowerCase();
    const time = row.querySelector('time');
    const timeText = (time?.textContent || '').replace(/\s+/g, ' ').trim();
    const metadata = /^(?:.*(?:edited|bearbeitet)|reply|replies|antwort(?:en)?|view.*repl|.*antworten?\s+ansehen|ansehen|anzeigen|gefällt.*|\d+\s*(?:likes?|std\.?|min\.?|sek\.?|[hdwms]))$/i;
    const texts = Array.from(row.querySelectorAll('span'))
    .map((span) => (span.textContent || '').trim())
    .filter((text) => text && text !== username && text !== rawUsername && text !== timeText
    && text.toLowerCase() !== profileSlug && !metadata.test(text));
    texts.sort((left, right) => right.length - left.length);
    const media = Array.from(row.querySelectorAll('img, video, canvas'));
    const gifAttr = (node: Element) => [node.getAttribute('src'), node.getAttribute('alt'), node.getAttribute('aria-label')].filter(Boolean).join(' ');
    const gif = media.some((node) => /gif|sticker/i.test(gifAttr(node)));
    const text = texts[0] || (gif ? '[GIF]' : '');
    if (username && text) {
    // Widen while the parent still belongs to this one comment (exactly one
    // /c/ permalink): the like count lives in the action bar below the text.
    const parent = row.parentElement;
    const height = parent?.getBoundingClientRect().height ?? 0;
    const sameComment = Boolean(parent && parent.querySelectorAll('a[href*="/c/"]').length === 1 && height > 0 && height <= 1800);
    if (sameComment) { row = parent; continue; }
    const raw = (row.textContent || '').replace(/\s+/g, ' ');
    const likes = raw.match(/(\d+[\d.,]*)\s*(?:likes?|gefällt\s*mir)/i) || raw.match(/gefällt\s+(\d+[\d.,]*)\s*mal/i);
    return {
    commentLikers: [], commentPermalink: row.querySelector('a[href*="/c/"]')?.getAttribute('href') || null,
    datetime: time?.getAttribute('datetime') || null, isGifOnly: text === '[GIF]', parentCommentPermalink: null,
    likesCount: likes ? Number.parseInt((likes[1] || '').replace(/[.,]/g, ''), 10) : 0,
    text, timeText, username, userProfilePath: user?.getAttribute('href') || null,
    };
    }
    row = row.parentElement;
  }
  return null;
};

export const computeCommentUidBrowser = (element: Element) => {
  const row = element.closest('li, [role="listitem"], article, div') || element;
  const profile = row.querySelector('a[href^="/"]')?.getAttribute('href') || '';
  const time = row.querySelector('time');
  const timestamp = time?.getAttribute('datetime') || time?.textContent || '';
  const text = (row.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const media = row.querySelector('img, video, canvas')?.getAttribute('src') || '';
  return `${profile}|${timestamp}|${text.slice(0, 120)}|${media}`;
};

export const resolveCommentRowBrowser = (element: Element) => {
  const strict = element.closest('li, [role="listitem"]');
  if (strict) return strict;
  let row: Element | null = element;
  for (let depth = 0; depth < 24 && row; depth += 1) {
    const rect = row.getBoundingClientRect();
    const profile = row.querySelector('a[href^="/"]');
    const permalink = row.querySelectorAll('a[href*="/c/"]').length === 1;
    const bounded = rect.width >= 180 && rect.height >= 28 && rect.height <= 1800;
    if (profile && permalink && row.querySelector('time') && bounded) return row;
    row = row.parentElement;
  }
  return element.parentElement || element;
};

export const listCommentRowsBrowser = () => {
  const root = /\/reels?\//.test(location.pathname)
    ? document.querySelector('[role="dialog"]') || document
    : document;
  const anchors = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href*="/c/"]'));
  const rows: Element[] = [];
  const seen = new Set<string>();
  for (const anchor of anchors) {
    const id = (anchor.getAttribute('href') || '').match(/\/c\/(\d+)/)?.[1];
    if (!id || seen.has(id)) continue;
    let row = anchor.closest('li, [role="listitem"]');
    let candidate = row || anchor.parentElement;
    for (let depth = 0; !row && depth < 24 && candidate; depth += 1) {
    const onePermalink = candidate.querySelectorAll('a[href*="/c/"]').length === 1;
    const profile = candidate.querySelector('a[href^="/"]');
    if (onePermalink && profile && candidate.querySelector('time')) row = candidate;
    candidate = candidate.parentElement;
    }
    if (!row || rows.includes(row)) continue;
    seen.add(id);
    rows.push(row);
  }
  const reply = (row: Element) => {
    const context = (row.closest('ul')?.parentElement?.textContent || '').toLowerCase();
    return context.includes('hide all replies') || context.includes('antworten verbergen');
  };
  return rows.sort((left, right) => Number(reply(right)) - Number(reply(left)));
};

export const readParentCommentPermalink = (element: Element) => {
  const row = element.closest('li, [role="listitem"], article, div') || element;
  const list = row.closest('ul');
  const context = (list?.parentElement?.textContent || '').toLowerCase();
  const reply = context.includes('hide all replies') || context.includes('antworten verbergen');
  if (!reply || !list) return null;
  let ancestor = list.parentElement;
  for (let depth = 0; depth < 8 && ancestor; depth += 1) {
    const anchors = Array.from(ancestor.querySelectorAll<HTMLAnchorElement>('a[href*="/c/"]'));
    const parent = anchors.find((anchor) => !list.contains(anchor));
    if (parent) return parent.getAttribute('href');
    ancestor = ancestor.parentElement;
  }
  return null;
};

export const refindCommentRowBrowser = (payload: RefindCommentPayload) => {
  const findRow = (element: Element) =>
    element.closest('li, [role="listitem"], article, div');
  if (payload.commentPermalink) {
    const anchor = document.querySelector(`a[href="${payload.commentPermalink}"]`);
    if (anchor) return findRow(anchor);
  }
  if (!payload.userProfilePath) return null;
  const anchors = Array.from(document.querySelectorAll(
    `a[href="${payload.userProfilePath}"]`,
  ));
  const target = anchors.find((anchor) => {
    const row = findRow(anchor);
    const content = (row?.textContent || '').toLowerCase();
    return content.includes(payload.username.toLowerCase())
    && content.includes(payload.text.slice(0, 80).toLowerCase());
  });
  return target ? findRow(target) : null;
};
