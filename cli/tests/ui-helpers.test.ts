import { beforeEach, describe, expect, it } from 'vitest';
import { getCommentContainer } from '../src/modules/scrape-comments/ui-container.ts';
import { expandAllReplyThreads, expandComments } from '../src/modules/scrape-comments/ui-expand.ts';
import { scrollCommentContainer } from '../src/modules/scrape-comments/ui-scroll.ts';

const setDocument = (value: unknown) => {
  Object.defineProperty(globalThis, 'document', { configurable: true, value });
};

const setWindow = (value: unknown) => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value });
};

const setLocation = (value: unknown) => {
  Object.defineProperty(globalThis, 'location', { configurable: true, value });
};

const evaluatePage = () => ({
  evaluate: async <T, A>(fn: (args: A) => T, args: A) => fn(args),
  waitForTimeout: async () => undefined,
});

describe('ui helpers', () => {
  beforeEach(() => {
    setLocation({ pathname: '/p/abc/' });
    delete (globalThis as typeof globalThis & { __instagramCliReplyAttempts?: Map<string, number> }).__instagramCliReplyAttempts;
  });

  it('finds the first matching comment container', async () => {
    const hit = { id: 'container' };
    setDocument({
      querySelector: (selector: string) =>
        selector.includes('ul') ? hit : null,
    });
    const result = await getCommentContainer(evaluatePage() as never);
    expect(result).toBe('div[role="dialog"] ul');
  });

  it('expands matching comment ui controls', async () => {
    let clicks = 0;
    let round = 0;
    setDocument({
      querySelectorAll: () => {
        round += 1;
        return round === 1
          ? [
              { textContent: 'View all 8 replies', dispatchEvent: () => { clicks += 1; } },
              { textContent: 'Reply', dispatchEvent: () => { clicks += 10; } },
            ]
          : [];
      },
    });
    Object.defineProperty(globalThis, 'MouseEvent', {
      configurable: true,
      value: class { constructor(_name: string, _opts: unknown) {} },
    });
    const result = await expandComments(evaluatePage() as never, 5);
    expect(result).toBe(1);
    expect(clicks).toBe(1);
  });

  it('expands reply threads', async () => {
    let clicks = 0;
    const attributes = new Map<string, string>();
    setDocument({
      querySelectorAll: () => [
        {
          click: () => { clicks += 1; },
          getAttribute: (name: string) => attributes.get(name) ?? null,
          setAttribute: (name: string, value: string) => { attributes.set(name, value); },
          textContent: 'View 2 replies',
        },
        {
          click: () => { clicks += 10; },
          getAttribute: () => null,
          setAttribute: () => undefined,
          textContent: 'Reply',
        },
      ],
    });
    const result = await expandAllReplyThreads(evaluatePage() as never, 5);
    expect(result).toBe(3);
    expect(clicks).toBe(3);
  });

  it('scrolls the window when no container exists', async () => {
    const state = { scrollY: 10, innerHeight: 100 };
    setDocument({ querySelectorAll: () => [] });
    setWindow({
      get innerHeight() { return state.innerHeight; },
      get scrollY() { return state.scrollY; },
      scrollBy: (_x: number, y: number) => { state.scrollY += y; },
    });
    const moved = await scrollCommentContainer(evaluatePage() as never, null, 1);
    expect(moved).toBe(true);
  });

  it('scrolls the container when available', async () => {
    const container = { clientHeight: 100, scrollHeight: 400, parentElement: null, scrollTop: 0 };
    setDocument({ querySelector: () => container });
    const moved = await scrollCommentContainer(evaluatePage() as never, '#comments', 1);
    expect(moved).toBe(true);
    expect(container.scrollTop).toBe(160);
  });

  it('scrolls a scrollable ancestor when the container itself is not scrollable', async () => {
    const parent = { clientHeight: 100, scrollHeight: 400, parentElement: null, scrollTop: 0 };
    const container = { clientHeight: 100, scrollHeight: 100, parentElement: parent, scrollTop: 0 };
    setDocument({ querySelector: () => container });
    const moved = await scrollCommentContainer(evaluatePage() as never, '#comments', 1);
    expect(moved).toBe(true);
    expect(parent.scrollTop).toBe(160);
  });
});
