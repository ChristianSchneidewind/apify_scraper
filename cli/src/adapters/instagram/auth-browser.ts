export const acceptCookieBanner = () => {
  const labels = [
    'Allow all cookies', 'Decline optional cookies', 'Only allow essential cookies',
    'Accept all', 'Accept All', 'Accept', 'Alle Cookies erlauben',
    'Optionale Cookies ablehnen',
  ];
  const nodes = Array.from(document.querySelectorAll('button, a, [role="button"]'));
  const target = nodes.find((node) => {
    const text = (node.textContent || '').trim();
    return labels.some((label) => text.includes(label));
  });
  if (!(target instanceof HTMLElement)) return false;
  const rect = target.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  target.click();
  return true;
};

export const dismissLoginWallBrowser = () => {
  const hide = () => {
    document.querySelectorAll<HTMLElement>('div[role="dialog"]').forEach((dialog) => {
    const text = (dialog.innerText || '').toLowerCase();
    const terms = ['log in', 'login', 'anmelden', 'sign up', 'registrieren',
    'see more from', 'mehr von instagram'];
    if (!terms.some((value) => text.includes(value))) return;
    dialog.style.setProperty('display', 'none', 'important');
    dialog.style.setProperty('visibility', 'hidden', 'important');
    dialog.style.setProperty('opacity', '0', 'important');
    dialog.parentElement?.style.setProperty('display', 'none', 'important');
    });
    document.body.style.overflow = 'auto';
  };
  hide();
  setInterval(hide, 500);
  return true;
};
