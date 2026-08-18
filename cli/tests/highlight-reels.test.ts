import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it, vi } from 'vitest';
import { browserRunPayload } from '../src/adapters/instagram/load-script.ts';

const SCRIPT = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/adapters/instagram/browser-scripts/highlight-comment.script'),
  'utf8',
);

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
    querySelector: (selector: string) => selector.includes('img') ? avatar : null,
    querySelectorAll: (selector: string) => selector.includes('img') ? [avatar] : [],
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

  const result = browserRunPayload({
    body: SCRIPT,
    payload: {
      commentPermalink: '/p/abc/c/1',
      el: row,
      isGifOnly: false,
      text: `${visibleText.replace('hello world', 'hello   world')} but its hidden ending is omitted`,
      userProfilePath: '/alice/',
      username: 'alice',
    },
  });
  expect(result).toMatchObject({ ok: true, rect: { h: 450, w: 243 } });
});
