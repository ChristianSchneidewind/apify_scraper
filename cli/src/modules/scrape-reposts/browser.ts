export const extractRepostLinks = () => {
  const allowed = new Set(['p', 'reel', 'reels', 'tv']);
  const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'));
  return anchors.map((anchor) => anchor.href).filter((href) => {
    if (!URL.canParse(href, location.href)) return false;
    const url = new URL(href, location.href);
    const instagram = ['www.instagram.com', 'instagram.com'].includes(url.hostname);
    if (!instagram) return false;
    const parts = url.pathname.split('/').filter(Boolean);
    return parts.some((part, index) => allowed.has(part) && Boolean(parts[index + 1]));
  });
};

export const waitForImages = () => {
  const waits = Array.from(document.images).map((image) => {
    if (image.complete) return Promise.resolve();
    return image.decode().catch(() => undefined);
  });
  return Promise.all(waits);
};
