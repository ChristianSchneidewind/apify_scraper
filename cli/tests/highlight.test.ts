import { beforeEach, describe, expect, it, vi } from 'vitest';
import { highlightCommentBrowser } from '../src/adapters/instagram/highlight-browser.ts';
import {
  buildHighlightPayload,
  ensureHighlightReady,
  highlightComment,
} from '../src/adapters/instagram/highlight.ts';

const sampleComment = {
  commentPermalink: '/p/abc/c/1',
  datetime: null,
  isGifOnly: false,
  text: 'hello world',
  timeText: '1h',
  userProfilePath: '/alice/',
  username: 'alice',
};

describe('buildHighlightPayload', () => {
  it('maps comment fields for browser highlight script', () => {
    expect(buildHighlightPayload(sampleComment)).toEqual({
      commentPermalink: '/p/abc/c/1',
      isGifOnly: false,
      text: 'hello world',
      userProfilePath: '/alice/',
      username: 'alice',
    });
  });
});

describe('highlightComment', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns highlight result from locator evaluate', async () => {
    const handle = {
      evaluate: vi.fn().mockResolvedValue({ ok: true }),
    };

    const result = await highlightComment(handle as never, sampleComment);
    expect(result.ok).toBe(true);
    expect(handle.evaluate).toHaveBeenCalledOnce();
  });

  it('falls back when evaluate returns empty result', async () => {
    const handle = {
      evaluate: vi.fn().mockResolvedValue(null),
    };

    const result = await highlightComment(handle as never, sampleComment);
    expect(result).toEqual({ ok: false, reason: 'invalid_result' });
  });
});

describe('highlight browser script', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('falls back to permalink anchors when the element is detached', () => {
    const row = {
      getBoundingClientRect: () => ({ width: 300, height: 40 }),
      querySelector: () => ({ getAttribute: () => '/alice/' }),
      querySelectorAll: () => [{ getAttribute: () => '/alice/' }],
      setAttribute: vi.fn(),
      style: {},
    } as never;
    const anchor = {
      closest: () => row,
      getAttribute: () => '/p/abc/c/1',
      innerText: 'alice hello world',
      querySelectorAll: () => [],
      parentElement: null,
    } as never;
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        body: { contains: () => false },
        querySelector: vi.fn().mockReturnValue(anchor),
        querySelectorAll: vi.fn().mockReturnValue([]),
      },
    });
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { pathname: '/p/abc/' },
    });

    const result = highlightCommentBrowser({} as never, sampleComment);
    expect(result).toMatchObject({ ok: true, detachedFallbackUsed: true });
  });

  it('returns detached_no_fallback when no fallback anchor exists', () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        body: { contains: () => false },
        querySelector: vi.fn().mockReturnValue(null),
        querySelectorAll: vi.fn().mockReturnValue([]),
      },
    });
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { pathname: '/p/abc/' },
    });

    const result = highlightCommentBrowser({} as never, sampleComment);
    expect(result).toEqual({ ok: false, reason: 'detached_no_fallback', isPostPage: true });
  });

  it('highlights the visible row when it already matches', () => {
    const row = {
      closest: (selector: string) => (selector.includes('li') ? row : null),
      getBoundingClientRect: () => ({ width: 300, height: 40 }),
      querySelector: (selector: string) => {
        if (selector.includes('time')) return {};
        if (selector.includes('/c/')) return { getAttribute: () => '/p/abc/c/1' };
        if (selector.includes('a[href]')) return { getAttribute: () => '/alice/' };
        return null;
      },
      querySelectorAll: (selector: string) => {
        if (selector.includes('a[href*="/c/"]')) return [{ getAttribute: () => '/p/abc/c/1' }];
        if (selector.includes('a[href]')) return [{ getAttribute: () => '/alice/' }];
        if (selector === 'img') return [];
        return [];
      },
      setAttribute: vi.fn(),
      style: {},
      tagName: 'LI',
    } as never;
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        body: { contains: () => true },
        querySelector: vi.fn().mockReturnValue(null),
        querySelectorAll: vi.fn().mockReturnValue([]),
      },
    });
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { pathname: '/p/abc/' },
    });

    const result = highlightCommentBrowser(row, sampleComment);
    expect(result).toMatchObject({ ok: true, expandedForAvatar: false, rowTag: 'LI' });
  });

  it('rejects a visible row that belongs to another comment', () => {
    const row = {
      closest: () => row,
      textContent: 'bob unrelated content',
    } as never;
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { body: { contains: () => true }, querySelectorAll: () => [] },
    });
    const result = highlightCommentBrowser(row, sampleComment);
    expect(result).toEqual({ ok: false, reason: 'row_content_mismatch' });
  });

  it('expands highlight to include avatar container when present on parent', () => {
    const parent = {
      parentElement: null,
      getBoundingClientRect: () => ({ width: 320, height: 72 }),
      querySelector: (selector: string) => {
        if (selector.includes('time')) return {};
        if (selector.includes('a[href]')) return { getAttribute: () => '/alice/' };
        return null;
      },
      querySelectorAll: (selector: string) => {
        if (selector.includes('a[href*="/c/"]')) return [{ getAttribute: () => '/p/abc/c/1' }];
        if (selector.includes('a[href]')) return [{ getAttribute: () => '/alice/' }];
        if (selector === 'img') return [{ getAttribute: (name: string) => (name === 'alt' ? 'alice profile picture' : ''), getBoundingClientRect: () => ({ width: 32, height: 32 }) }];
        return [];
      },
      setAttribute: vi.fn(),
      style: {},
      tagName: 'DIV',
    } as never;
    const row = {
      parentElement: parent,
      closest: (selector: string) => (selector.includes('li') ? row : null),
      getBoundingClientRect: () => ({ width: 300, height: 40 }),
      querySelector: (selector: string) => {
        if (selector.includes('time')) return {};
        if (selector.includes('/c/')) return { getAttribute: () => '/p/abc/c/1' };
        if (selector.includes('a[href]')) return { getAttribute: () => '/alice/' };
        return null;
      },
      querySelectorAll: (selector: string) => {
        if (selector.includes('a[href*="/c/"]')) return [{ getAttribute: () => '/p/abc/c/1' }];
        if (selector.includes('a[href]')) return [{ getAttribute: () => '/alice/' }];
        if (selector === 'img') return [];
        return [];
      },
      setAttribute: vi.fn(),
      style: {},
      tagName: 'LI',
    } as never;
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        body: { contains: () => true },
        querySelector: vi.fn().mockReturnValue(null),
        querySelectorAll: vi.fn().mockReturnValue([]),
      },
    });
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { pathname: '/p/abc/' },
    });

    const result = highlightCommentBrowser(row, sampleComment);
    expect(result).toMatchObject({ ok: true, expandedForAvatar: true, rowTag: 'LI', selectedTag: 'DIV' });
  });
});

describe('ensureHighlightReady', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('retries until highlight succeeds', async () => {
    const handle = {
      evaluate: vi.fn()
        .mockResolvedValueOnce({ ok: false, reason: 'not_ready' })
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce({ ok: true }),
    };

    const result = await ensureHighlightReady(handle as never, sampleComment);
    expect(result.ok).toBe(true);
    expect(handle.evaluate).toHaveBeenCalledTimes(3);
  });

  it('returns exhausted reason after three failed attempts', async () => {
    const handle = {
      evaluate: vi.fn().mockResolvedValue({ ok: false, reason: 'not_ready' }),
    };

    const result = await ensureHighlightReady(handle as never, sampleComment);
    expect(result).toEqual({ ok: false, reason: 'highlight_retries_exhausted' });
    expect(handle.evaluate).toHaveBeenCalledTimes(6);
  });
});
