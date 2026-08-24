export const readDebugRows = () => {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('div[role="dialog"] *'));
  return nodes.filter((element) => {
    const rect = element.getBoundingClientRect();
    const content = (element.textContent || '').trim();
    const media = element.querySelector('time, img[alt*="GIF" i], img[src*="gif" i]');
    return Boolean(media || content) && rect.width > 120 && rect.height > 20;
  }).slice(0, 300).map((element, index) => {
    const rect = element.getBoundingClientRect();
    return {
    hasGif: Boolean(element.querySelector('img[alt*="GIF" i], img[src*="gif" i]')),
    hasTime: Boolean(element.querySelector('time')),
    index,
    rect: { height: rect.height, width: rect.width, x: rect.x, y: rect.y },
    tag: element.tagName,
    text: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 220),
    };
  });
};

export const reinforceHighlight = (element: Element) => {
  document.querySelectorAll('[data-apify-highlight-overlay="1"]')
    .forEach((overlay) => overlay.remove());
  const banner = document.getElementById('apify-screenshot-banner');
  const maxBottom = window.innerHeight - (banner?.getBoundingClientRect().height || 0) - 20;
  document.querySelectorAll<HTMLElement>('[data-apify-highlight="1"]').forEach((node) => {
    node.style.outline = '4px solid red';
    node.style.outlineOffset = '2px';
    node.style.boxShadow = '0 0 0 4px red inset';
    const rect = node.getBoundingClientRect();
    const top = Math.max(20, rect.top);
    const bottom = Math.min(maxBottom, rect.bottom);
    if (bottom <= top) return;
    const overlay = document.createElement('div');
    overlay.setAttribute('data-apify-highlight-overlay', '1');
    overlay.style.cssText = `position:fixed;pointer-events:none;z-index:2147483646;left:${Math.max(0, rect.left - 4)}px;top:${top}px;width:${Math.max(1, rect.width + 8)}px;height:${Math.max(1, bottom - top)}px;border:4px solid red;box-sizing:border-box`;
    document.body.appendChild(overlay);
  });
  return Boolean(element);
};
