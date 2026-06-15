import { describe, expect, it } from 'vitest';
import { buildCommentLinks } from '../src/modules/scrape-comments/comment-links.ts';

describe('buildCommentLinks', () => {
  it('builds comment url and deep link', () => {
    expect(buildCommentLinks('/p/abc/c/12', 'https://www.instagram.com/p/abc/?foo=1')).toEqual({
      commentDeepLink: 'https://www.instagram.com/p/abc/?comment_id=12',
      commentUrl: 'https://www.instagram.com/p/abc/c/12',
    });
  });
});
