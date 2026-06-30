export const LONG_TEXT_THRESHOLD = 400;
export const FORCED_MULTIPART_BASE = 400;

export type MultipartMetrics = {
  hasInnerScroll?: boolean;
  overflow?: number;
  rowHeight?: number;
  visibleH?: number;
};

export const shouldForceRowMultipart = (textLen: number, mode: string, metrics?: MultipartMetrics) => {
  if (textLen < FORCED_MULTIPART_BASE || mode !== 'single') return false;
  if (!metrics) return true;
  const visibleH = Math.max(220, metrics.visibleH ?? 0);
  const rowHeight = Math.max(0, metrics.rowHeight ?? 0);
  const overflow = Math.max(0, metrics.overflow ?? 0);
  return overflow > 24 || rowHeight >= Math.max(220, visibleH * 0.58);
};

export const calcForcedParts = (textLen: number) =>
  Math.min(6, Math.max(2, Math.floor((textLen + (FORCED_MULTIPART_BASE - 1)) / FORCED_MULTIPART_BASE)));

export const totalParts = (scrollParts: number[]) => Math.max(1, scrollParts.length);

export const shouldUse3PlusRoute = (parts: number) => parts >= 2;

export const hasMultipartEvidence = (mode: string, scrollParts: number[], metrics?: MultipartMetrics) => {
  if (scrollParts.length < 2) return false;
  if (mode === 'inner') return !!metrics?.hasInnerScroll;
  if (mode === 'row') return (metrics?.overflow ?? 0) > 24;
  return false;
};

export const estimateRowParts = (metrics?: MultipartMetrics) => {
  const visibleH = Math.max(220, metrics?.visibleH ?? 0);
  const rowHeight = Math.max(visibleH, metrics?.rowHeight ?? visibleH);
  const overflow = Math.max(0, metrics?.overflow ?? (rowHeight - visibleH));
  if (overflow <= 24) return 1;
  const overlapRatio = rowHeight > (visibleH * 2) ? 0.22 : 0.35;
  const stepPx = Math.max(120, visibleH * (1 - overlapRatio));
  return Math.min(6, Math.max(2, Math.ceil(overflow / stepPx) + 1));
};
