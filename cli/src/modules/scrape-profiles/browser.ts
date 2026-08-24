export const extractProfile = () => {
  const readText = (node: Element | null) =>
    (node?.textContent || '').replace(/\s+/g, ' ').trim();
  const description = document.querySelector('meta[name="description"]')
    ?.getAttribute('content') || '';
  const heading = document.querySelector('header h1, header h2');
  const usernameNode = document.querySelector('header section h2, header h1');
  const candidates = Array.from(document.querySelectorAll('header section span'));
  const statNodes = Array.from(document.querySelectorAll('header li, header section ul li'));
  const stats = statNodes.map(readText).filter(Boolean);
  const username = readText(usernameNode) || readText(heading) || null;
  const biography = candidates.map(readText).find((value) => {
    if (!value || value === username || stats.includes(value)) return false;
    const lower = value.toLowerCase();
    return !lower.includes('followers') && !lower.includes('following');
  });
  return {
    avatarUrl: document.querySelector('header img')?.getAttribute('src') || null,
    biography: biography || description,
    description,
    fullName: readText(heading) || null,
    stats,
    title: document.title,
    url: location.href,
    username,
  };
};

export const setProfileBanner = (text: string) => {
  const id = 'apify-screenshot-banner';
  const existing = document.getElementById(id);
  const banner = existing || document.createElement('div');
  if (!existing) document.body.appendChild(banner);
  banner.id = id;
  banner.textContent = text;
  banner.style.cssText = [
    'display:block', 'position:absolute', 'left:0',
    `top:${document.documentElement.scrollHeight}px`, 'transform:translateY(-100%)',
    'z-index:2147483647', 'width:100vw', 'box-sizing:border-box',
    'margin:0', 'padding:10px 12px', 'background:#fff', 'color:#000',
    'font-size:12px', 'font-family:monospace', 'line-height:1.35',
    'white-space:pre-line', 'word-break:break-all', 'pointer-events:none',
  ].join(';');
};
