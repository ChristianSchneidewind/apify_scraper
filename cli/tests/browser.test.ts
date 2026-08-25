import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connectCdp: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('../src/adapters/cdp/connection.ts', () => ({ connectCdp: mocks.connectCdp }));
vi.stubGlobal('fetch', mocks.fetch);

import { closeBrowserSession, openBrowserSession } from '../src/adapters/cdp/browser.ts';

const context = {
  cdp: { url: 'http://127.0.0.1:9222' },
  cwd: '/tmp/project',
};

const jsonResponse = (value: unknown) => ({
  json: () => Promise.resolve(value),
  ok: true,
});

const buildClient = () => ({
  close: vi.fn().mockResolvedValue(undefined),
  off: vi.fn(),
  on: vi.fn(),
  send: vi.fn().mockImplementation((method: string) => {
    if (method === 'Target.attachToTarget') return Promise.resolve({ sessionId: 'session-1' });
    if (method === 'Target.createTarget') return Promise.resolve({ targetId: 'target-new' });
    return Promise.resolve({});
  }),
});

describe('cdp browser adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('attaches to an existing instagram tab', async () => {
    const client = buildClient();
    mocks.connectCdp.mockResolvedValue(client);
    mocks.fetch.mockImplementation((url: string) => {
      if (url.endsWith('/json/version')) return jsonResponse({ webSocketDebuggerUrl: 'ws://x' });
      return jsonResponse([{ id: 't-1', type: 'page', url: 'https://www.instagram.com/' }]);
    });

    const session = await openBrowserSession(context);

    expect(mocks.connectCdp).toHaveBeenCalledWith('ws://x');
    expect(client.send).toHaveBeenCalledWith('Target.attachToTarget', { flatten: true, targetId: 't-1' });
    expect(session.page.url()).toBe('https://www.instagram.com/');
  });

  it('creates a new tab when no page target exists', async () => {
    const client = buildClient();
    mocks.connectCdp.mockResolvedValue(client);
    mocks.fetch.mockImplementation((url: string) => {
      if (url.endsWith('/json/version')) return jsonResponse({ webSocketDebuggerUrl: 'ws://x' });
      return jsonResponse([]);
    });

    await openBrowserSession(context);

    expect(client.send).toHaveBeenCalledWith('Target.createTarget', { url: 'about:blank' });
  });

  it('fails with setup instructions when chrome is unreachable', async () => {
    mocks.fetch.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(openBrowserSession(context)).rejects.toThrow(/remote debugging/i);
  }, 15_000);

  it('closes the browser session without closing chrome', async () => {
    const browser = { close: vi.fn().mockResolvedValue(undefined) };
    await closeBrowserSession(browser);
    expect(browser.close).toHaveBeenCalled();
  });
});
