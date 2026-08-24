import type { HighlightPayload, HighlightResult } from '../../schemas/index.ts';

export const highlightCommentBrowser = (
  element: Element,
  payload: HighlightPayload,
): HighlightResult => {
  document.querySelectorAll('[data-apify-highlight-overlay="1"]')
    .forEach((node) => node.remove());
  const attached = Boolean(document.body?.contains(element));
  const fallback = !attached && payload.commentPermalink
    ? document.querySelector(`a[href="${payload.commentPermalink}"]`)
    : null;
  if (!attached && !fallback) {
    return { isPostPage: /\/p\//.test(location.pathname), ok: false, reason: 'detached_no_fallback' };
  }
  const source = attached ? element : fallback;
  const row = source?.closest('li, [role="listitem"], article, div') || source;
  if (!row) return { ok: false, reason: 'row_missing' };
  const content = (row.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const expected = payload.text.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 80);
  const mismatch = content && (!content.includes(payload.username.toLowerCase()) || (!payload.isGifOnly && expected && !content.includes(expected)));
  if (mismatch) return { ok: false, reason: 'row_content_mismatch' };
  const parent = row.parentElement; const images = Array.from(parent?.querySelectorAll('img') || []);
  const avatar = images.some((image) => /profile|profil/i.test(image.getAttribute('alt') || ''));
  const rowRect = row.getBoundingClientRect();
  const tight = row.querySelector('time') && row.querySelector('a[href]') && row.querySelectorAll('a[href*="/c/"]').length === 1 && rowRect.width >= 180 && rowRect.height >= 28 && rowRect.height <= 1800;
  if (!tight) return { ok: false, reason: 'row_not_tight' };
  const parentRect = parent?.getBoundingClientRect();
  const bounded = Boolean(parentRect
    && parentRect.width <= rowRect.width + 120
    && parentRect.height <= rowRect.height + 180
    && (parent?.querySelectorAll('a[href*="/c/"]').length ?? 2) <= 1);
  const selected = avatar && bounded && parent ? parent : row;
  const rect = selected.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return { ok: false, reason: 'not_visible' };
  if (typeof HTMLElement !== 'undefined' && selected instanceof HTMLElement) {
    selected.setAttribute('data-apify-highlight', '1');
    selected.style.outline = '4px solid red';
    selected.style.outlineOffset = '2px';
    selected.style.boxShadow = '0 0 0 4px red inset';
  }
  return {
    detachedFallbackUsed: !attached, expandedForAvatar: selected !== row,
    ok: true, rect: { h: rect.height, w: rect.width },
    rowTag: row.tagName, selectedTag: selected.tagName,
  };
};
