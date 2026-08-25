import type {
  MultipartPlanResult,
  MultipartVerifyPayload,
  MultipartVerifyResult,
  RefindCommentPayload,
} from '../../../schemas/index.ts';

// Serialized into the page — every export must stay self-contained (no
// module-scope references). Row resolution walks up from the comment element
// to the smallest container holding the whole comment (time, <=1 /c/
// permalink, username anchor with text, avatar image). Post pages do not wrap
// comments in <li>, so closest('li') never matches there; avatar and likes
// row sit several divs above the text block. Keep in sync with the copy in
// adapters/instagram/highlight-browser.ts.
export const expandCommentBrowser = (element: Element) => {
  const chain: Element[] = []; let node: Element | null = element;
  while (node && node !== document.body && node !== document.documentElement && chain.length < 24) { chain.push(node); node = node.parentElement; }
  const userLink = (link: HTMLAnchorElement) => /^\/[A-Za-z0-9._]+\/?$/.test(link.getAttribute('href') || '') && Boolean((link.textContent || '').trim());
  const qualifies = (el: Element) => typeof el.querySelector === 'function' && el.querySelectorAll('a[href*="/c/"]').length <= 1 && Boolean(el.querySelector('time')) && Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')).some(userLink);
  const hasAvatar = (el: Element) => Array.from(el.querySelectorAll('img')).some((img) => /profil|profile/i.test(img.getAttribute('alt') || ''));
  const candidates = chain.filter(qualifies);
  const row = candidates.find(hasAvatar) || candidates[0] || element.closest('li, [role="listitem"], article, div') || element;
  row.querySelectorAll<HTMLElement>('span, div, p').forEach((child) => {
    if (child.scrollHeight - child.clientHeight > 24) return;
    child.style.setProperty('max-height', 'none', 'important');
    child.style.setProperty('height', 'auto', 'important');
    child.style.setProperty('overflow', 'visible', 'important');
    child.style.setProperty('-webkit-line-clamp', 'unset', 'important');
  });
};

export const planMultipartBrowser = (
  element: Element,
  payload: RefindCommentPayload,
): MultipartPlanResult => {
  const chain: Element[] = []; let node: Element | null = element;
  while (node && node !== document.body && node !== document.documentElement && chain.length < 24) { chain.push(node); node = node.parentElement; }
  const userLink = (link: HTMLAnchorElement) => /^\/[A-Za-z0-9._]+\/?$/.test(link.getAttribute('href') || '') && Boolean((link.textContent || '').trim());
  const qualifies = (el: Element) => typeof el.querySelector === 'function' && el.querySelectorAll('a[href*="/c/"]').length <= 1 && Boolean(el.querySelector('time')) && Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')).some(userLink);
  const hasAvatar = (el: Element) => Array.from(el.querySelectorAll('img')).some((img) => /profil|profile/i.test(img.getAttribute('alt') || ''));
  const candidates = chain.filter(qualifies);
  const row = candidates.find(hasAvatar) || candidates[0] || element.closest('li, [role="listitem"], article, div') || element;
  if (!document.body.contains(row)) return { mode: 'single', ok: false, sig: null, tops: [0] };
  const rect = row.getBoundingClientRect();
  // The effective viewport is the scrollport that actually clips the row
  // (nearest ancestor with non-visible overflow-y and real overflow); post
  // pages clip comments to an inner scrollport far shorter than the window.
  const clips = (el: Element) => !['visible', 'clip'].includes(getComputedStyle(el).overflowY) && el.scrollHeight - el.clientHeight > 20;
  const container = chain.slice(Math.max(0, chain.indexOf(row)) + 1).find((el) => clips(el)) || null;
  const containerRect = container?.getBoundingClientRect();
  const banner = document.getElementById('apify-screenshot-banner');
  const windowVisible = window.innerHeight - (banner?.getBoundingClientRect().height || 0) - 40;
  const containerVisible = containerRect ? Math.min(window.innerHeight - (banner?.getBoundingClientRect().height || 0), containerRect.bottom) - Math.max(0, containerRect.top) : Number.POSITIVE_INFINITY;
  const visibleHeight = Math.max(220, Math.min(windowVisible, containerVisible));
  const inner = Array.from(row.querySelectorAll<HTMLElement>('*')).find((child) => child.scrollHeight - child.clientHeight > 24 && child.clientHeight >= 60);
  const rowOverflow = Math.max(0, rect.height - visibleHeight);
  const innerOverflow = inner ? inner.scrollHeight - inner.clientHeight : 0;
  // Only multipart when content actually overflows the visible strip; tall
  // but fully visible rows stay single (the single-probe escalates if the
  // row ends up clipped anyway).
  const mode = rowOverflow > 24 ? 'row' : inner && innerOverflow > 24 ? 'inner' : 'single';
  const overflow = mode === 'inner' ? innerOverflow : rowOverflow;
  const step = mode === 'inner' ? Math.max(140, (inner?.clientHeight || 180) - 40) : Math.max(120, visibleHeight * 0.78);
  const parts = mode === 'single' ? 1 : Math.min(6, Math.max(2, Math.ceil(overflow / step) + 1));
  const href = row.querySelector('a[href^="/"]')?.getAttribute('href') || '';
  const timestamp = row.querySelector('time')?.getAttribute('datetime') || '';
  return {
    metrics: { hasInnerScroll: mode === 'inner', overflow, rowHeight: rect.height, visibleH: visibleHeight },
    mode, ok: true,
    sig: `${href}|${timestamp}|${payload.text.slice(0, 180).toLowerCase()}`,
    tops: Array.from({ length: parts }, (_, index) => mode === 'inner' ? Math.min(overflow, index * step) : index),
  };
};

export const verifyMultipartBrowser = (
  element: Element,
  payload: MultipartVerifyPayload,
): MultipartVerifyResult => {
  const chain: Element[] = []; let node: Element | null = element;
  while (node && node !== document.body && node !== document.documentElement && chain.length < 24) { chain.push(node); node = node.parentElement; }
  const userLink = (link: HTMLAnchorElement) => /^\/[A-Za-z0-9._]+\/?$/.test(link.getAttribute('href') || '') && Boolean((link.textContent || '').trim());
  const qualifies = (el: Element) => typeof el.querySelector === 'function' && el.querySelectorAll('a[href*="/c/"]').length <= 1 && Boolean(el.querySelector('time')) && Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')).some(userLink);
  const hasAvatar = (el: Element) => Array.from(el.querySelectorAll('img')).some((img) => /profil|profile/i.test(img.getAttribute('alt') || ''));
  const candidates = chain.filter(qualifies);
  const row = candidates.find(hasAvatar) || candidates[0] || element.closest('li, [role="listitem"], article, div') || element;
  document.querySelectorAll('[data-apify-highlight-overlay="1"]').forEach((overlay) => overlay.remove());
  if (!document.body.contains(row)) return { ok: false, reason: 'row_not_found' };
  const clips = (el: Element) => !['visible', 'clip'].includes(getComputedStyle(el).overflowY) && el.scrollHeight - el.clientHeight > 20;
  const parent = chain.slice(Math.max(0, chain.indexOf(row)) + 1).find((el) => clips(el)) || null;
  const parentRect = parent?.getBoundingClientRect(); const intersects = Boolean(parentRect && parentRect.bottom > 0 && parentRect.top < window.innerHeight);
  const containerTop = parentRect && intersects ? Math.max(0, parentRect.top) : 0; const containerBottom = parentRect && intersects ? Math.min(window.innerHeight, parentRect.bottom) : window.innerHeight;
  const banner = document.getElementById('apify-screenshot-banner'); const maxBottom = Math.min(containerBottom, window.innerHeight - (banner?.clientHeight || 0) - 20);
  const revealTop = Math.max(8, containerTop + 4); const visibleHeight = Math.max(220, maxBottom - revealTop);
  const inner = payload.mode === 'inner' ? Array.from(row.querySelectorAll<HTMLElement>('*')).find((child) => child.scrollHeight - child.clientHeight > 24) : null;
  if (inner) inner.scrollTop = Math.max(0, payload.top);
  const initialRect = row.getBoundingClientRect();
  const overflow = payload.mode === 'inner' ? Math.max(0, (inner?.scrollHeight || 0) - (inner?.clientHeight || 0)) : Math.max(0, initialRect.height - visibleHeight);
  const segment = payload.mode === 'inner' ? 0 : overflow * Math.min(1, payload.top / Math.max(1, payload.partsTotal - 1));
  // Scroll only when needed: scrollport nudges fire Instagram's list
  // observers, which stall evaluates and can detach the row between parts.
  if (payload.partsTotal > 1 || initialRect.top < revealTop || initialRect.bottom > maxBottom) {
    if (parent) parent.scrollTop += initialRect.top - revealTop + segment;
    else { row.scrollIntoView({ block: 'start' }); window.scrollBy(0, segment - 20); }
  }
  const positioned = row.getBoundingClientRect(); if (positioned.height <= visibleHeight && positioned.top < revealTop) row.scrollIntoView({ block: 'start', behavior: 'instant' });
  const rect = row.getBoundingClientRect();
  // Clip spans from the reveal line down to the row bottom (or scrollport edge),
  // so the final part includes the comment end; 8px left margin keeps the outline inside.
  const clipTop = payload.partsTotal > 1 ? revealTop : Math.max(revealTop, Math.min(window.innerHeight - 1, rect.top)); const clipLeft = Math.max(0, rect.left - 8);
  return {
    clip: {
    height: Math.max(1, Math.min(rect.bottom, maxBottom) - clipTop), y: clipTop,
    width: Math.max(1, Math.min(window.innerWidth - clipLeft, rect.width + 16)), x: clipLeft,
    },
    clippedBottom: rect.bottom > maxBottom, clippedTop: rect.top < revealTop - 8,
    maxBottom, ok: true, rowBottom: rect.bottom, rowTop: rect.top,
    metrics: { hasInnerScroll: payload.mode === 'inner', overflow, rowHeight: rect.height, visibleH: visibleHeight },
  };
};
