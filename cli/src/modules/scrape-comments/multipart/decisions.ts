export const LONG_TEXT_THRESHOLD = 430;
export const FORCED_MULTIPART_BASE = 430;

export const shouldForceRowMultipart = (textLen: number, mode: string) =>
  textLen >= FORCED_MULTIPART_BASE && mode === 'single';

export const calcForcedParts = (textLen: number) =>
  Math.min(6, Math.max(2, Math.floor((textLen + (FORCED_MULTIPART_BASE - 1)) / FORCED_MULTIPART_BASE)));

export const totalParts = (scrollParts: number[]) => Math.max(1, scrollParts.length);

export const shouldUse3PlusRoute = (parts: number) => parts >= 3;
