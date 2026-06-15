export function setScreenshotBanner(args: { text: string }) {
  const id = 'apify-screenshot-banner';
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
  }
  el.textContent = args.text;
  el.style.display = 'block';
  el.style.position = 'fixed';
  el.style.left = '0';
  el.style.right = '0';
  el.style.bottom = '0';
  el.style.zIndex = '2147483647';
  el.style.width = '100vw';
  el.style.boxSizing = 'border-box';
  el.style.margin = '0';
  el.style.padding = '10px 12px';
  el.style.background = '#fff';
  el.style.color = '#000';
  el.style.fontSize = '12px';
  el.style.fontFamily = 'monospace';
  el.style.lineHeight = '1.35';
  el.style.whiteSpace = 'pre-line';
  el.style.borderRadius = '0';
  el.style.maxWidth = 'none';
  el.style.wordBreak = 'break-all';
  el.style.pointerEvents = 'none';
}

export const bannerText = (
  session: {
    screenshotUtc: string;
    screenshotUuid: string;
  },
  pageUrl: string,
  commentIndex: number,
  part: number,
  total: number,
) => `${pageUrl}\n${session.screenshotUtc} | c#${commentIndex} | ${session.screenshotUuid.slice(0, 8)} | part ${part}/${total}`;
