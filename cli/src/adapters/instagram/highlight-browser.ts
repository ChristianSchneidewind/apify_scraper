import type { HighlightPayload, HighlightResult } from '../../schemas/index.ts';

export const highlightCommentBrowser = (
  element: Element,
  payload: HighlightPayload,
): HighlightResult => {
  // Row resolution walks up to the smallest container holding the whole
  // comment (time, <=1 /c/ permalink, username anchor with text, avatar
  // image). Post pages do not wrap comments in <li>, so closest('li') never
  // matches there; avatar and likes row sit several divs above the text
  // block. Keep in sync with the copies in scrape-comments/multipart/browser.ts.
  document.querySelectorAll('[data-apify-highlight-overlay="1"]').forEach((node) => node.remove());
  const attached = Boolean(document.body?.contains(element));
  const fallbackAnchor = !attached && payload.commentPermalink ? document.querySelector(`a[href="${payload.commentPermalink}"]`) : null;
  if (!attached && !fallbackAnchor) return { isPostPage: /\/p\//.test(location.pathname), ok: false, reason: 'detached_no_fallback' };
  const source = (attached ? element : fallbackAnchor) as Element;
  const chain: Element[] = [];
  let node: Element | null = source;
  while (node && node !== document.body && node !== document.documentElement && chain.length < 24) { chain.push(node); node = node.parentElement; }
  const userLink = (link: HTMLAnchorElement) => /^\/[A-Za-z0-9._]+\/?$/.test(link.getAttribute('href') || '') && Boolean((link.textContent || '').trim());
  const qualifies = (el: Element) => typeof el.querySelector === 'function' && el.querySelectorAll('a[href*="/c/"]').length <= 1 && Boolean(el.querySelector('time')) && Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')).some(userLink);
  const hasAvatar = (el: Element) => Array.from(el.querySelectorAll('img')).some((img) => /profil|profile/i.test(img.getAttribute('alt') || ''));
  const candidates = chain.filter(qualifies);
  const base = candidates[0] || null;
  const selected = candidates.find(hasAvatar) || base || source.closest('li, [role="listitem"], article, div') || source;
  const content = (selected.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const expected = payload.text.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 80);
  const mismatch = content && (!content.includes(payload.username.toLowerCase()) || (!payload.isGifOnly && expected && !content.includes(expected)));
  if (mismatch) return { ok: false, reason: 'row_content_mismatch' };
  const rect = selected.getBoundingClientRect();
  const tight = rect.width >= 180 && rect.height >= 28 && rect.height <= 4000;
  if (!tight) return { ok: false, reason: 'row_not_tight' };
  if (typeof HTMLElement !== 'undefined' && selected instanceof HTMLElement) { selected.setAttribute('data-apify-highlight', '1'); selected.style.cssText += ';outline:4px solid red;outline-offset:2px;box-shadow:0 0 0 4px red inset'; }
  return { detachedFallbackUsed: !attached, expandedForAvatar: Boolean(base) && selected !== base, ok: true, rect: { h: rect.height, w: rect.width }, rowTag: base?.tagName || selected.tagName, selectedTag: selected.tagName };
};
