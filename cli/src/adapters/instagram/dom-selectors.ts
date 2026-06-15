export const COMMENT_TIME_SELECTOR =
  'div[role="dialog"] time, article time, li time, time';

export const POST_COMMENT_LI_ROWS_SELECTOR =
  'div[role="dialog"] li:has(a[href*="/p/"][href*="/c/"]):has(time), '
  + 'article li:has(a[href*="/p/"][href*="/c/"]):has(time), '
  + 'main article li:has(a[href*="/p/"][href*="/c/"]):has(time)';

export const POST_COMMENT_LAST_RESORT_SELECTOR =
  'article div:has(a[href*="/c/"]):has(time), '
  + 'main article div:has(a[href*="/c/"]):has(time)';

export const DIALOG_COMMENT_ROWS_SELECTOR =
  'div[role="dialog"] ul li:has(time), '
  + 'div[role="dialog"] li[role="listitem"]:has(time), '
  + 'div[role="dialog"] li._a9zj:has(time), '
  + 'div[role="dialog"] li._a9zj._a9zl:has(time)';

export const POST_COMMENT_ROWS_FALLBACK_SELECTOR =
  'article ul li:has(time), '
  + 'main article ul li:has(time), '
  + 'article div:has(a[href*="/p/"][href*="/c/"]):has(time)';

export const COMMENT_PERMALINK_SELECTOR =
  'a[href*="/p/"][href*="/c/"], '
  + 'a[href*="/reel/"][href*="/c/"], '
  + 'a[href*="/reels/"][href*="/c/"], '
  + 'a[href*="/c/"]';

export const COMMENT_CONTAINER_SELECTORS = [
  'div[role="dialog"] ul',
  'article ul',
  'main article ul',
  'div[role="dialog"]',
] as const;

export const LOAD_MORE_TEXTS = [
  'View all',
  'View more',
  'Load more',
  'Show more',
  'more comments',
  'Alle ansehen',
  'Mehr anzeigen',
  'Weitere Kommentare',
] as const;
