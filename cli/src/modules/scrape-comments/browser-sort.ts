export const readCommentSort = () => {
  const terms = ['newest', 'most recent', 'neueste', 'neueste zuerst'];
  const selector = 'button, [role="button"], [role="menuitem"], [role="option"], [tabindex="0"]';
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
  const active = nodes.find((node) => {
    const style = window.getComputedStyle(node);
    const visible = style.display !== 'none' && style.visibility !== 'hidden';
    const label = [node.ariaLabel, node.title, node.textContent].filter(Boolean)
    .join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
    const newest = terms.some((term) => label === term || label.startsWith(term));
    const trigger = node.getAttribute('aria-haspopup') === 'menu' || node.hasAttribute('aria-expanded');
    return visible && newest && trigger;
  });
  return active ? 'already_newest' : 'not_newest';
};

export const openCommentSortMenu = () => {
  const terms = ['for you', 'für dich', 'most relevant', 'relevanteste'];
  const selector = 'button, [role="button"], [aria-expanded], [aria-haspopup="menu"]';
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
  const trigger = nodes.find((node) => {
    const label = [node.ariaLabel, node.title, node.textContent].filter(Boolean)
    .join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
    return terms.some((term) => label === term || label.startsWith(term));
  });
  if (!trigger) return false;
  if (trigger.getAttribute('aria-expanded') !== 'true') trigger.click();
  return true;
};

export const clickNewestCommentSort = () => {
  const terms = ['newest', 'most recent', 'neueste', 'neueste zuerst'];
  const selector = '[role="menu"] button, [role="menuitem"], [role="option"]';
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
  const option = nodes.find((node) => {
    const style = window.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const label = [node.ariaLabel, node.title, node.textContent].filter(Boolean)
    .join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
    const match = terms.some((term) => label === term || label.startsWith(term));
    return match && style.display !== 'none' && rect.width > 0 && rect.height > 0;
  });
  const clickable = option?.closest<HTMLElement>('button, [role="menuitem"], [role="option"]') || option;
  if (!clickable) return false;
  clickable.click();
  return true;
};
