import { describe, expect, it } from 'vitest';
import {
  calcForcedParts,
  FORCED_MULTIPART_BASE,
  hasMultipartEvidence,
  shouldForceRowMultipart,
  shouldUse3PlusRoute,
  totalParts,
} from '../src/modules/scrape-comments/multipart/decisions.ts';

describe('multipart decisions', () => {
  it('forces row multipart for long comments with overflow or a tall enough block', () => {
    expect(shouldForceRowMultipart(FORCED_MULTIPART_BASE, 'single')).toBe(true);
    expect(shouldForceRowMultipart(FORCED_MULTIPART_BASE - 1, 'single', { overflow: 200, rowHeight: 900, visibleH: 500 })).toBe(false);
    expect(shouldForceRowMultipart(FORCED_MULTIPART_BASE, 'row', { overflow: 200, rowHeight: 900, visibleH: 500 })).toBe(false);
    expect(shouldForceRowMultipart(FORCED_MULTIPART_BASE, 'single', { overflow: 200, rowHeight: 900, visibleH: 500 })).toBe(true);
    expect(shouldForceRowMultipart(FORCED_MULTIPART_BASE, 'single', { overflow: 0, rowHeight: 380, visibleH: 620 })).toBe(true);
  });

  it('uses the 400-character boundary', () => {
    expect(shouldForceRowMultipart(399, 'single', { overflow: 200, rowHeight: 900, visibleH: 500 })).toBe(false);
    expect(shouldForceRowMultipart(400, 'single', { overflow: 200, rowHeight: 900, visibleH: 500 })).toBe(true);
  });

  it('forces multipart at 400+ even when metrics are missing', () => {
    expect(shouldForceRowMultipart(399, 'single')).toBe(false);
    expect(shouldForceRowMultipart(400, 'single')).toBe(true);
  });

  it('calculates forced parts with upper bound', () => {
    expect(calcForcedParts(FORCED_MULTIPART_BASE)).toBe(2);
    expect(calcForcedParts(FORCED_MULTIPART_BASE * 3)).toBe(3);
    expect(calcForcedParts(FORCED_MULTIPART_BASE * 10)).toBe(6);
  });

  it('counts total parts from scroll tops', () => {
    expect(totalParts([0])).toBe(1);
    expect(totalParts([0, 1, 2])).toBe(3);
    expect(totalParts([])).toBe(1);
  });

  it('selects tile route for two or more parts', () => {
    expect(shouldUse3PlusRoute(1)).toBe(false);
    expect(shouldUse3PlusRoute(2)).toBe(true);
    expect(shouldUse3PlusRoute(3)).toBe(true);
    expect(shouldUse3PlusRoute(6)).toBe(true);
  });

  it('requires real multipart evidence', () => {
    expect(hasMultipartEvidence('single', [0, 1], { overflow: 200 })).toBe(false);
    expect(hasMultipartEvidence('row', [0, 1], { overflow: 0 })).toBe(false);
    expect(hasMultipartEvidence('row', [0, 1], { overflow: 50 })).toBe(true);
    expect(hasMultipartEvidence('inner', [0, 200], { hasInnerScroll: false })).toBe(false);
    expect(hasMultipartEvidence('inner', [0, 200], { hasInnerScroll: true })).toBe(true);
  });
});
