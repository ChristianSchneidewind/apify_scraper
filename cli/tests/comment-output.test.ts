import { describe, expect, it } from 'vitest';
import { buildCommentOutputRecord } from '../src/modules/scrape-comments/output.ts';

describe('buildCommentOutputRecord', () => {
  it('adds screenshot and multipart fields', () => {
    expect(
      buildCommentOutputRecord(
        {
          commentPermalink: '/p/abc/c/1',
          datetime: null,
          text: 'hello',
          timeText: '1h',
          username: 'alice',
          userProfilePath: '/alice/',
          commentLikers: [],
          likesCount: 0,
        },
        'https://www.instagram.com/p/abc/',
        3,
        ['uuid-1.png'],
        ['/tmp/out/uuid-1.png'],
        '/tmp/out/uuid-1.json',
      ),
    ).toMatchObject({
      commentDeepLink: 'https://www.instagram.com/p/abc/?comment_id=1',
      commentUrl: 'https://www.instagram.com/p/abc/c/1',
      index: 3,
      metadataPath: '/tmp/out/uuid-1.json',
      multipartFlagReason: null,
      multipartNeedsReview: false,
      partsTotal: 1,
      screenshotKey: 'uuid-1.png',
      screenshotKeys: ['uuid-1.png'],
      screenshotPath: '/tmp/out/uuid-1.png',
      screenshotPaths: ['/tmp/out/uuid-1.png'],
      sourceUrl: 'https://www.instagram.com/p/abc/',
    });
  });
});
