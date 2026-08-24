import type {
  MultipartPlanResult,
  MultipartVerifyPayload,
  MultipartVerifyResult,
  RefindCommentPayload,
} from '../../../schemas/index.ts';

export const expandCommentBrowser = (element: Element) => {
  const row = element.closest('li, [role="listitem"], article, div') || element;
  row.querySelectorAll<HTMLElement>('span, div, p').forEach((node) => {
    if (node.scrollHeight - node.clientHeight > 24) return;
    node.style.setProperty('max-height', 'none', 'important');
    node.style.setProperty('height', 'auto', 'important');
    node.style.setProperty('overflow', 'visible', 'important');
    node.style.setProperty('-webkit-line-clamp', 'unset', 'important');
  });
};

export const planMultipartBrowser = (
  element: Element,
  payload: RefindCommentPayload,
): MultipartPlanResult => {
  const row = element.closest<HTMLElement>('li, [role="listitem"], article, div');
  if (!row || !document.body.contains(row)) {
    return { mode: 'single', ok: false, sig: null, tops: [0] };
  }
  const rect = row.getBoundingClientRect();
  const banner = document.getElementById('apify-screenshot-banner');
  const bannerHeight = banner?.getBoundingClientRect().height || 0;
  const visibleHeight = Math.max(220, window.innerHeight - bannerHeight - 40);
  const inner = Array.from(row.querySelectorAll<HTMLElement>('*'))
    .find((node) => node.scrollHeight - node.clientHeight > 24 && node.clientHeight >= 60);
  const rowOverflow = Math.max(0, rect.height - visibleHeight);
  const innerOverflow = inner ? inner.scrollHeight - inner.clientHeight : 0;
  const mode = rect.height > visibleHeight * 0.82 ? 'row' : inner ? 'inner' : 'single';
  const overflow = mode === 'inner' ? innerOverflow : rowOverflow;
  const step = mode === 'inner' ? Math.max(140, (inner?.clientHeight || 180) - 40) : Math.max(120, visibleHeight * 0.78);
  const parts = mode === 'single' ? 1 : Math.min(6, Math.max(2, Math.ceil(overflow / step) + 1));
  const href = row.querySelector('a[href^="/"]')?.getAttribute('href') || '';
  const timestamp = row.querySelector('time')?.getAttribute('datetime') || '';
  return {
    metrics: { hasInnerScroll: mode === 'inner', overflow, rowHeight: rect.height, visibleH: visibleHeight },
    mode,
    ok: true,
    sig: `${href}|${timestamp}|${payload.text.slice(0, 180).toLowerCase()}`,
    tops: Array.from({ length: parts }, (_, index) => mode === 'inner' ? Math.min(overflow, index * step) : index),
  };
};

export const verifyMultipartBrowser = (
  element: Element,
  payload: MultipartVerifyPayload,
): MultipartVerifyResult => {
  document.querySelectorAll('[data-apify-highlight-overlay="1"]')
    .forEach((node) => node.remove());
  const row = element.closest<HTMLElement>('li, [role="listitem"], article, div');
  if (!row || !document.body.contains(row)) return { ok: false, reason: 'row_not_found' };
  const banner = document.getElementById('apify-screenshot-banner');
  const visibleHeight = Math.max(220, window.innerHeight - (banner?.clientHeight || 0) - 40);
  const inner = payload.mode === 'inner'
    ? Array.from(row.querySelectorAll<HTMLElement>('*')).find((node) => node.scrollHeight - node.clientHeight > 24)
    : null;
  if (inner) inner.scrollTop = Math.max(0, payload.top);
  const initialRect = row.getBoundingClientRect();
  const overflow = payload.mode === 'inner'
    ? Math.max(0, (inner?.scrollHeight || 0) - (inner?.clientHeight || 0))
    : Math.max(0, initialRect.height - visibleHeight);
  const denominator = Math.max(1, payload.partsTotal - 1);
  const segment = payload.mode === 'inner' ? 0 : overflow * Math.min(1, payload.top / denominator);
  let parent = row.parentElement;
  while (parent && parent.scrollHeight - parent.clientHeight <= 20) parent = parent.parentElement;
  if (parent) parent.scrollTop += initialRect.top - parent.getBoundingClientRect().top + segment;
  else {
    row.scrollIntoView({ block: 'start' });
    window.scrollBy(0, segment - 20);
  }
  row.setAttribute('data-apify-highlight', '1');
  row.style.outline = '4px solid red';
  row.style.outlineOffset = '2px';
  row.style.boxShadow = '0 0 0 4px red inset';
  const rect = row.getBoundingClientRect();
  const chunk = payload.partsTotal > 1 ? Math.min(visibleHeight, rect.height / payload.partsTotal + 80) : rect.height;
  const y = Math.max(0, Math.min(window.innerHeight - 1, rect.top));
  return {
    clip: {
    height: Math.max(1, Math.min(window.innerHeight - y, chunk)), y,
    width: Math.max(1, Math.min(window.innerWidth - Math.max(0, rect.left), rect.width)), x: Math.max(0, rect.left),
    },
    clippedBottom: rect.bottom > window.innerHeight - 20, maxBottom: window.innerHeight - 20,
    metrics: { hasInnerScroll: payload.mode === 'inner', overflow, rowHeight: rect.height, visibleH: visibleHeight },
    ok: true, rowBottom: rect.bottom, rowTop: rect.top,
  };
};
