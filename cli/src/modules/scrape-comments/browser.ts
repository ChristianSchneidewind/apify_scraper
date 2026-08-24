export const openReelComments = () => {
  if (document.querySelector('[role="dialog"]')) return true;
  const buttons = Array.from(document.querySelectorAll<HTMLElement>('[role="button"]'));
  const button = buttons.find((node) => {
    const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
    return /^(Comment|Kommentar)\s*\d/i.test(text);
  });
  if (!button) return false;
  button.click();
  return true;
};

export const expandCommentControls = (texts: readonly string[]) => {
  const selector = 'button, [role="button"], a, span[role="button"]';
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
  let count = 0;
  nodes.forEach((element) => {
    const text = (element.textContent || '').trim();
    const lower = text.toLowerCase();
    const replies = (lower.includes('repl') || lower.includes('antwort')) && /\d/.test(text);
    const view = ['view', 'more', 'anzeigen', 'ansehen'].some((word) => lower.includes(word));
    const matches = texts.some((item) => text.includes(item)) || (replies && view);
    if (!text || lower === 'reply' || lower === 'antworten' || !matches) return;
    if (typeof element.click === 'function') element.click();
    else element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    count += 1;
  });
  return count;
};

export const expandOneReplyControl = () => {
  const selector = 'button, [role="button"], a, span[role="button"]';
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
  const target = nodes.find((element) => {
    const text = (element.textContent || '').trim().toLowerCase();
    const reply = text.includes('repl') || text.includes('antwort');
    const action = ['view', 'show', 'anzeigen', 'ansehen', 'more']
    .some((word) => text.includes(word));
    return reply && (action || /\d/.test(text));
  });
  if (!target) return 0;
  if (typeof target.click === 'function') target.click();
  else target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  return 1;
};

export const scrollComments = (container: string | null) => {
  const reel = /\/reels?\//.test(location.pathname);
  let target = container ? document.querySelector(container) : null;
  while (target && target.scrollHeight - target.clientHeight <= 40) {
    target = target.parentElement;
  }
  if (!target) {
    const root = reel ? document.querySelector('[role="dialog"]') : document;
    const nodes = Array.from(root?.querySelectorAll<HTMLElement>('div, ul, section') || []);
    const candidates = nodes.filter((node) =>
    node.querySelectorAll('time').length > (reel ? 0 : 1)
    && node.scrollHeight - node.clientHeight > 40);
    candidates.sort((a, b) => b.scrollHeight - b.clientHeight - a.scrollHeight + a.clientHeight);
    target = candidates[0] || null;
  }
  if (!target) {
    if (reel) return false;
    const before = window.scrollY;
    window.scrollBy(0, window.innerHeight * 0.8);
    return Math.abs(window.scrollY - before) > 10;
  }
  const before = target.scrollTop;
  target.scrollTop = Math.min(before + Math.max(160, target.clientHeight * 0.95), target.scrollHeight);
  return Math.abs(target.scrollTop - before) > 0;
};

export const resetCommentsScroll = (container: string | null) => {
  const reel = /\/reels?\//.test(location.pathname);
  const selected = container ? document.querySelector(container) : null;
  const root = reel ? document.querySelector('[role="dialog"]') : selected || document;
  const nodes = Array.from(root?.querySelectorAll<HTMLElement>('div, ul, section, article') || []);
  const candidates = nodes.filter((node) =>
    node.querySelectorAll('time').length > 0 && node.scrollHeight - node.clientHeight > 40);
  candidates.sort((a, b) => b.scrollHeight - b.clientHeight - a.scrollHeight + a.clientHeight);
  const target = candidates[0] || selected;
  if (target) target.scrollTop = 0;
  if (!reel) window.scrollTo(0, 0);
  return true;
};
