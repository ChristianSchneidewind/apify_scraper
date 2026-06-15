import { describe, expect, it } from 'vitest';
import { bannerText } from '../src/modules/scrape-comments/capture/banner.ts';

describe('bannerText', () => {
  it('includes url, comment index, uuid, and part info', () => {
    expect(
      bannerText(
        {
          screenshotUtc: '2026-06-08 12:00:00 UTC',
          screenshotUuid: 'uuid-1234',
        },
        'https://www.instagram.com/p/abc/',
        7,
        2,
        4,
      ),
    ).toContain('https://www.instagram.com/p/abc/');
    expect(
      bannerText(
        {
          screenshotUtc: '2026-06-08 12:00:00 UTC',
          screenshotUuid: 'uuid-1234',
        },
        'https://www.instagram.com/p/abc/',
        7,
        2,
        4,
      ),
    ).toContain('c#7');
  });
});
