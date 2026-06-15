import { describe, expect, it } from 'vitest';
import {
  calcForcedParts,
  FORCED_MULTIPART_BASE,
  shouldForceRowMultipart,
  shouldUse3PlusRoute,
  totalParts,
} from '../src/modules/scrape-comments/multipart/decisions.ts';

describe('multipart decisions', () => {
  it('forces row multipart for long single-mode text', () => {
    expect(shouldForceRowMultipart(FORCED_MULTIPART_BASE, 'single')).toBe(true);
    expect(shouldForceRowMultipart(FORCED_MULTIPART_BASE - 1, 'single')).toBe(false);
    expect(shouldForceRowMultipart(FORCED_MULTIPART_BASE, 'row')).toBe(false);
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

  it('selects 3plus route for three or more parts', () => {
    expect(shouldUse3PlusRoute(2)).toBe(false);
    expect(shouldUse3PlusRoute(3)).toBe(true);
    expect(shouldUse3PlusRoute(6)).toBe(true);
  });
});
