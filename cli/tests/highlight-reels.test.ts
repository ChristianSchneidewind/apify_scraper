import { expect, it, vi } from 'vitest';
import { highlightCommentBrowser } from '../src/adapters/instagram/highlight-browser.ts';

it('normalizes whitespace and accepts tall Reel comment rows', () => {
  const avatar = {
    getAttribute: (name: string) => (name === 'alt' ? 'alice profile picture' : ''),
    getBoundingClientRect: () => ({ width: 32, height: 32 }),
  };
  const visibleText = 'hello world this is a long comment whose visible prefix remains available after collapsing';
  const row = {
    closest: () => row,
    getBoundingClientRect: () => ({ width: 243, height: 450 }),
    innerText: `alice ${visibleText}`,
    parentElement: null,
    querySelector: (selector: string) => {
      if (selector.includes('img')) return avatar;
      if (selector.includes('time')) return {};
      if (selector.includes('a[href')) return { getAttribute: () => '/alice/' };
      return null;
    },
    querySelectorAll: (selector: string) => {
      if (selector.includes('img')) return [avatar];
      if (selector.includes('/c/')) return [{ getAttribute: () => '/p/abc/c/1' }];
      return [];
    },
    setAttribute: vi.fn(),
    style: {},
    tagName: 'DIV',
  } as never;
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      body: { contains: () => true },
      querySelectorAll: vi.fn().mockReturnValue([]),
    },
  });
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { pathname: '/reels/abc/' },
  });

  const result = highlightCommentBrowser(row, {
    commentPermalink: '/p/abc/c/1',
    isGifOnly: false,
    text: `${visibleText.replace('hello world', 'hello   world')} but its hidden ending is omitted`,
    userProfilePath: '/alice/',
    username: 'alice',
  });
  expect(result).toMatchObject({ ok: true, rect: { h: 450, w: 243 } });
});
