export const isLikersDialogOpen = () => {
  const dialogs = document.querySelectorAll('[role="dialog"]');
  return /\/reels?\//.test(location.pathname) ? dialogs.length > 1 : dialogs.length > 0;
};

export const resetLikersDialog = () => {
  const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
  const dialog = dialogs.item(dialogs.length - 1);
  if (!dialog) return false;
  dialog.querySelectorAll<HTMLElement>('div, ul, section, main')
    .forEach((node) => { node.scrollTop = 0; });
  return true;
};

export const scrollLikersDialogEnd = () => {
  const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
  const dialog = dialogs.item(dialogs.length - 1);
  if (!dialog) return false;
  const nodes = Array.from(dialog.querySelectorAll<HTMLElement>('div, ul, section, main'));
  const target = nodes.sort((a, b) => b.scrollHeight - a.scrollHeight)[0] || dialog;
  const before = target.scrollTop;
  target.scrollTop = Math.max(0, target.scrollHeight - target.clientHeight);
  return Math.abs(target.scrollTop - before) > 2;
};

export const nudgeLikersDialogEnd = () => {
  const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
  const dialog = dialogs.item(dialogs.length - 1);
  if (!dialog) return false;
  const nodes = Array.from(dialog.querySelectorAll<HTMLElement>('div, ul, section, main'));
  const target = nodes.sort((a, b) => b.scrollHeight - a.scrollHeight)[0] || dialog;
  const end = Math.max(0, target.scrollHeight - target.clientHeight);
  target.scrollTop = Math.max(0, end - Math.max(180, target.clientHeight * 0.4));
  target.scrollTop = end;
  return true;
};

export const oscillateLikersDialogEnd = () => {
  const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
  const dialog = dialogs.item(dialogs.length - 1);
  if (!dialog) return false;
  const nodes = Array.from(dialog.querySelectorAll<HTMLElement>('div, ul, section, main'));
  const target = nodes.sort((a, b) => b.scrollHeight - a.scrollHeight)[0] || dialog;
  const end = Math.max(0, target.scrollHeight - target.clientHeight);
  target.scrollTop = Math.max(0, end - Math.max(220, target.clientHeight * 0.7));
  target.scrollTop = end;
  return true;
};

export const collectLikersDialogBatch = () => {
  const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
  const dialog = dialogs.item(dialogs.length - 1);
  if (!dialog) return { canScroll: false, items: [], open: false };
  const links = Array.from(dialog.querySelectorAll<HTMLAnchorElement>('a[href^="/"]'));
  const items = links.map((link) => {
    const profilePath = link.getAttribute('href') || '';
    const fromHref = profilePath.split('/').filter(Boolean)[0] || '';
    const username = (link.textContent || '').trim().replace(/\s+/g, '') || fromHref;
    return { profilePath, username };
  }).filter((item) => /^[A-Za-z0-9._]{2,30}$/.test(item.username));
  const canScroll = Array.from(dialog.querySelectorAll<HTMLElement>('div, ul, section, main'))
    .some((node) => node.scrollHeight > node.clientHeight + 20);
  return { canScroll, items, open: true };
};

export const findInlineLikesTarget = (
  element: Element,
  commentPermalink: string | null,
) => {
  const row = element.closest('li, [role="listitem"], article, div') || element;
  const permalink = commentPermalink
    ? row.querySelector(`a[href="${commentPermalink}"]`)
    : null;
  const scope = permalink?.closest('li, [role="listitem"], article, div') || row;
  const text = (scope.textContent || '').replace(/\s+/g, ' ');
  const match = text.match(/(\d+[\d.,]*)\s*likes?/i)
    || text.match(/(\d+[\d.,]*)\s*gefällt\s*mir/i);
  const likesCount = match
    ? Number.parseInt((match[1] || '').replace(/[.,]/g, ''), 10) || 0
    : 0;
  const controls = Array.from(scope.querySelectorAll<HTMLElement>(
    'button, a, [role="button"], [tabindex="0"]',
  ));
  const target = controls.find((node) => {
    const label = [node.textContent, node.ariaLabel, node.title].filter(Boolean).join(' ');
    return /\d+[\d.,]*\s*(likes?|gefällt)/i.test(label);
  });
  if (!target) return { clicked: false, likesCount, ok: true, reason: 'likes_button_not_found' };
  target.setAttribute('data-instagram-cli-likes-target', '1');
  return { clicked: true, likesCount, ok: true };
};

export const readCommentLikesCount = (element: Element) => {
  const row = element.closest('li, [role="listitem"], article, div') || element;
  const text = (row.textContent || '').replace(/\s+/g, ' ');
  const match = text.match(/(\d+[\d.,]*)\s*likes?/i)
    || text.match(/(\d+[\d.,]*)\s*gefällt\s*mir/i);
  return match ? Number.parseInt((match[1] || '').replace(/[.,]/g, ''), 10) || 0 : 0;
};
