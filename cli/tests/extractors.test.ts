import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browserRunElement } from '../src/adapters/instagram/load-script.ts';
import type * as LoadScriptModule from '../src/adapters/instagram/load-script.ts';

vi.mock('../src/adapters/instagram/load-script.ts', async () => {
  const actual = await vi.importActual<typeof LoadScriptModule>('../src/adapters/instagram/load-script.ts');
  return {
    ...actual,
    browserRunElement: vi.fn(),
  };
});

import {
  computeCommentUid,
  extractCommentFromTime,
  listTimeLocators,
  resolveCommentRowHandle,
} from '../src/modules/scrape-comments/extract-from-locator.ts';

const SCRIPTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../src/modules/scrape-comments/browser-scripts');
const EXTRACT_ITEM_SCRIPT = readFileSync(join(SCRIPTS_DIR, 'extract-item.script'), 'utf8');
const EXTRACT_ONE_SCRIPT = readFileSync(join(SCRIPTS_DIR, 'extract-one.script'), 'utf8');

describe('extractors', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    const actual = await vi.importActual<typeof LoadScriptModule>('../src/adapters/instagram/load-script.ts');
    vi.mocked(browserRunElement).mockImplementation((args, el) => actual.browserRunElement(args, el));
  });

  it('extracts comment data from time locator', async () => {
    const expected = { text: 'hello', username: 'alice' };
    const locator = { evaluate: vi.fn().mockResolvedValue(expected) };
    const result = await extractCommentFromTime(locator as never);
    expect(result).toBe(expected);
  });

  it('computes comment uid from time locator', async () => {
    const locator = { evaluate: vi.fn().mockResolvedValue('uid-1') };
    const result = await computeCommentUid(locator as never);
    expect(result).toBe('uid-1');
  });

  it('lists time locators from page', async () => {
    const elementHandles = vi.fn().mockResolvedValue(['a', 'b']);
    const page = { locator: vi.fn().mockReturnValue({ elementHandles }) };
    const result = await listTimeLocators(page as never);
    expect(result).toEqual(['a', 'b']);
  });

  it('resolves a tighter comment row handle when available', async () => {
    const row = { id: 'row' };
    const handle = {
      asElement: vi.fn().mockReturnValue(row),
      dispose: vi.fn(),
    };
    const locator = {
      evaluateHandle: vi.fn().mockResolvedValue(handle),
    };

    const result = await resolveCommentRowHandle(locator as never);
    expect(result).toBe(row);
  });

  it('extract-item browser script ignores edited-only fragments and keeps real comment text', async () => {
    const permalink = { getAttribute: vi.fn().mockReturnValue('/p/abc/c/1') };
    const time = {
      textContent: '6 Wo.',
      getAttribute: vi.fn().mockReturnValue('2026-05-14T07:24:24.000Z'),
    };
    const profile = {
      textContent: 'afdwatchbremenVerifiziert',
      getAttribute: vi.fn().mockReturnValue('/afdwatchbremen/'),
    };
    const spans = [
      { textContent: 'afdwatchbremenVerifiziert' },
      { textContent: '6 Wo.' },
      { textContent: '6 Wo. · Bearbeitet' },
      { textContent: 'afdwatchbremen' },
      { textContent: 'Was für rassistische Hetze!' },
    ];
    const item = {
      querySelectorAll: vi.fn((selector: string) => {
        if (selector === 'a[role="link"], a') return [profile, permalink];
        if (selector === 'span') return spans;
        if (selector === 'img, video, canvas') return [];
        return [];
      }),
      querySelector: vi.fn((selector: string) => {
        if (selector === 'time') return time;
        if (selector === 'a[href*="/c/"]') return permalink;
        return null;
      }),
      innerText: 'afdwatchbremenVerifiziert 6 Wo. 6 Wo. · Bearbeitet afdwatchbremen Was für rassistische Hetze!',
      parentElement: null,
      previousElementSibling: null,
      nextElementSibling: null,
    };

    const result = browserRunElement({ body: EXTRACT_ITEM_SCRIPT }, item as never) as { text?: string; username?: string } | null;
    expect(result).toMatchObject({ username: 'afdwatchbremenVerifiziert', text: 'Was für rassistische Hetze!' });
  });

  it('extract-item browser script keeps short single-word comments', async () => {
    const permalink = { getAttribute: vi.fn().mockReturnValue('/p/abc/c/2') };
    const time = {
      textContent: '6 Wo.',
      getAttribute: vi.fn().mockReturnValue('2026-05-14T07:24:24.000Z'),
    };
    const profile = {
      textContent: 'alice',
      getAttribute: vi.fn().mockReturnValue('/alice/'),
    };
    const item = {
      querySelectorAll: vi.fn((selector: string) => {
        if (selector === 'a[role="link"], a') return [profile, permalink];
        if (selector === 'span') return [
          { textContent: 'alice' },
          { textContent: '6 Wo.' },
          { textContent: 'Wtf' },
        ];
        if (selector === 'img, video, canvas') return [];
        return [];
      }),
      querySelector: vi.fn((selector: string) => {
        if (selector === 'time') return time;
        if (selector === 'a[href*="/c/"]') return permalink;
        return null;
      }),
      innerText: 'alice 6 Wo. Wtf',
      parentElement: null,
      previousElementSibling: null,
      nextElementSibling: null,
    };

    const result = browserRunElement({ body: EXTRACT_ITEM_SCRIPT }, item as never) as { text?: string; username?: string } | null;
    expect(result).toMatchObject({ username: 'alice', text: 'Wtf' });
  });

  it('extract-one browser script rejects username-only fragments and returns the actual comment text', async () => {
    const profile = {
      textContent: 'afdwatchbremenVerifiziert',
      getAttribute: vi.fn().mockReturnValue('/afdwatchbremen/'),
    };
    const permalink = { getAttribute: vi.fn().mockReturnValue('/p/abc/c/1') };
    const node = {
      parentElement: null,
      querySelectorAll: vi.fn((selector: string) => {
        if (selector === 'a[role="link"], a') return [profile, permalink];
        if (selector === 'span') return [
          { textContent: 'afdwatchbremenVerifiziert' },
          { textContent: '5 Wo.' },
          { textContent: 'afdwatchbremen' },
          { textContent: 'Was für rassistische Hetze!' },
        ];
        return [];
      }),
      querySelector: vi.fn((selector: string) => {
        if (selector === 'a[href*="/c/"]') return permalink;
        return null;
      }),
    };
    const timeEl = {
      textContent: '5 Wo.',
      getAttribute: vi.fn().mockReturnValue('2026-05-14T07:24:24.000Z'),
      parentElement: node,
    };

    const result = browserRunElement({ body: EXTRACT_ONE_SCRIPT }, timeEl as never) as { text?: string; username?: string } | null;
    expect(result).toMatchObject({ username: 'afdwatchbremenVerifiziert', text: 'Was für rassistische Hetze!' });
  });

  it('extract-one browser script keeps short single-word comments', async () => {
    const profile = {
      textContent: 'alice',
      getAttribute: vi.fn().mockReturnValue('/alice/'),
    };
    const permalink = { getAttribute: vi.fn().mockReturnValue('/p/abc/c/2') };
    const node = {
      parentElement: null,
      querySelectorAll: vi.fn((selector: string) => {
        if (selector === 'a[role="link"], a') return [profile, permalink];
        if (selector === 'span') return [
          { textContent: 'alice' },
          { textContent: '6 Wo.' },
          { textContent: 'BRUH' },
        ];
        return [];
      }),
      querySelector: vi.fn((selector: string) => {
        if (selector === 'a[href*="/c/"]') return permalink;
        return null;
      }),
    };
    const timeEl = {
      textContent: '6 Wo.',
      getAttribute: vi.fn().mockReturnValue('2026-05-14T07:24:24.000Z'),
      parentElement: node,
    };

    const result = browserRunElement({ body: EXTRACT_ONE_SCRIPT }, timeEl as never) as { text?: string; username?: string } | null;
    expect(result).toMatchObject({ username: 'alice', text: 'BRUH' });
  });
});
