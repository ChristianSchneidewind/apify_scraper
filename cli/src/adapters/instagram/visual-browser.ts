export const forceLightMode = () => {
  try {
    localStorage.setItem('ig_theme', 'light');
    localStorage.setItem('ig-theme', 'light');
    sessionStorage.setItem('ig_theme', 'light');
    document.cookie = 'ig_theme=light; path=/; max-age=31536000';
  } catch {}
  document.documentElement.setAttribute('data-theme', 'light');
  document.body?.setAttribute('data-theme', 'light');
  document.documentElement.classList.forEach((name) => {
    if (name.includes('dark')) document.documentElement.classList.remove(name);
  });
  document.documentElement.style.setProperty('color-scheme', 'light', 'important');
  document.documentElement.style.setProperty('--ig-primary-background', '#fff', 'important');
  document.documentElement.style.setProperty('--ig-primary-text', '#000', 'important');
  document.body?.style.setProperty('background', '#fff', 'important');
};

export const freezeAnimatedMedia = () => {
  document.querySelectorAll('video').forEach((video) => video.pause());
};

export const hideVisualOverlays = () => {
  const selector = '[role="banner"], [aria-label="Reels navigation controls"], header, nav';
  document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    if (element.querySelector('[data-apify-highlight="1"]')) return;
    element.style.setProperty('opacity', '0', 'important');
    element.style.setProperty('pointer-events', 'none', 'important');
  });
};

export const fitCommentViewport = (element: Element) => {
  const reel = /\/reels?\//.test(location.pathname);
  const dialog = reel ? element.closest('[role="dialog"]') : null;
  const target = element.closest<HTMLElement>('li, [role="listitem"], article, div');
  if (!target) return false;
  let parent = target.parentElement;
  while (parent) {
    const scrollable = parent.scrollHeight - parent.clientHeight > 20;
    if (scrollable && (!dialog || dialog.contains(parent))) break;
    parent = parent.parentElement;
  }
  if (parent) {
    const offset = target.getBoundingClientRect().top - parent.getBoundingClientRect().top;
    parent.scrollTop += offset - (parent.clientHeight / 2);
  }
  if (!reel) {
    target.scrollIntoView({ block: 'center', inline: 'nearest' });
    window.scrollBy(0, -120);
  }
  return true;
};
