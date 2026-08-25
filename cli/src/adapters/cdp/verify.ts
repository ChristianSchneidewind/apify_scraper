import type { CdpHandle, CdpPage, VisibilityQuote, VisibilityTracker } from '../../schemas/index.ts';

const visibilityBrowser = (el: Element) => {
  const rect = el.getBoundingClientRect();
  const within = rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
  return within && rect.width > 0 && rect.height > 0;
};

export const isHandleVisible = (handle: CdpHandle): Promise<boolean> =>
  handle.evaluate(visibilityBrowser, undefined).catch(() => false);

export const verifyUrlContains = (page: CdpPage, fragment: string) =>
  page.url().includes(fragment);

export const createVisibilityTracker = (): VisibilityTracker => {
  const flagged: string[] = [];
  let visible = 0;
  let total = 0;
  const quote = (): VisibilityQuote => ({
    flagged: flagged.length,
    percent: total === 0 ? 100 : Math.round((visible / total) * 1000) / 10,
    total,
    visible,
  });
  const record = (id: string, isVisible: boolean) => {
    total += 1;
    if (isVisible) visible += 1;
    else flagged.push(id);
  };
  return {
    flag: (id: string) => { flagged.push(id); },
    flaggedIds: () => [...flagged],
    quote,
    record,
  };
};

export const formatVisibilityQuote = (quote: VisibilityQuote) =>
  `${quote.total} captures, ${quote.percent}% visibility, ${quote.flagged} flagged`;
