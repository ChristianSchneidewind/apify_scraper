import type { BrowserClosePort, CdpAttachResult, CdpBrowserSession, CdpClient, CdpCreateTargetResult, CdpHttpTarget, CdpPage, CdpTargetInfo, CdpVersionInfo, RuntimeContext } from '../../schemas/index.ts';
import { connectCdp } from './connection.ts';
import { createCdpPage } from './page.ts';

const SETUP_HINT = [
  'Chrome remote debugging is not reachable.',
  'Enable it via chrome://inspect/#remote-debugging,',
  'start Chrome with --remote-debugging-port=9222,',
  'or run: chrome-agent launch',
].join(' ');

const fetchJson = async <R>(url: string): Promise<R> => {
  const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error(`CDP HTTP ${response.status} for ${url}`);
  return (await response.json()) as R;
};

const tryFetchVersion = async (cdpUrl: string) => {
  try {
    const version = await fetchJson<CdpVersionInfo>(`${cdpUrl}/json/version`);
    return version.webSocketDebuggerUrl;
  } catch {
    return null;
  }
};

const browserWebSocketUrl = async (cdpUrl: string): Promise<string> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const wsUrl = await tryFetchVersion(cdpUrl);
    if (wsUrl) return wsUrl;
    await new Promise((resolve) => { setTimeout(resolve, 250); });
  }
  throw new Error(`${SETUP_HINT} (tried ${cdpUrl})`);
};

const toTargetInfo = (target: CdpHttpTarget): CdpTargetInfo => {
  const info: CdpTargetInfo = { targetId: target.id ?? '', type: target.type };
  if (target.url) info.url = target.url;
  return info;
};

const listPageTargets = async (cdpUrl: string): Promise<CdpTargetInfo[]> => {
  const raw = await fetchJson<CdpHttpTarget[]>(`${cdpUrl}/json/list`).catch(() => []);
  return raw.filter((target) => target.type === 'page' && target.id).map(toTargetInfo);
};

const pickTarget = (targets: CdpTargetInfo[]) =>
  targets.find((target) => target.url?.includes('instagram.com')) ?? targets[0] ?? null;

const attachPage = async (
  client: CdpClient,
  targetId: string,
  url: string,
): Promise<CdpPage> => {
  const { sessionId } = await client.send<CdpAttachResult>(
    'Target.attachToTarget',
    { flatten: true, targetId },
  );
  await client.send('Page.enable', undefined, sessionId);
  await client.send('Runtime.enable', undefined, sessionId);
  return createCdpPage({ client, sessionId, targetId }, url, () => createPage(client));
};

const createPage = async (client: CdpClient): Promise<CdpPage> => {
  const { targetId } = await client.send<CdpCreateTargetResult>(
    'Target.createTarget',
    { url: 'about:blank' },
  );
  return attachPage(client, targetId, 'about:blank');
};

const openPage = async (client: CdpClient, cdpUrl: string): Promise<CdpPage> => {
  const target = pickTarget(await listPageTargets(cdpUrl));
  if (target) return attachPage(client, target.targetId, target.url ?? 'about:blank');
  return createPage(client);
};

export const openBrowserSession = async (context: RuntimeContext): Promise<CdpBrowserSession> => {
  const cdpUrl = context.cdp.url.replace(/\/$/, '');
  const client = await connectCdp(await browserWebSocketUrl(cdpUrl));
  const page = await openPage(client, cdpUrl);
  return {
    browser: { close: () => client.close() },
    browserContext: { newPage: () => createPage(client) },
    page,
  };
};

export const closeBrowserSession = async (browser: BrowserClosePort) => {
  await browser.close();
};
