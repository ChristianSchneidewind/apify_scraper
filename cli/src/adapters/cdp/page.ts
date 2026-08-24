import type { CdpBrowserContext, CdpClient, CdpFrameInfo, CdpGotoOptions, CdpKeyboard, CdpLocator, CdpPage, CdpPageDeps } from '../../schemas/index.ts';
import { evaluatePage, evaluatePageHandle } from './evaluate.ts';
import { createCdpHandle } from './handle.ts';
import { pressKey } from './input.ts';
import { createCdpLocator } from './locator.ts';
import { captureScreenshot } from './screenshot.ts';

const NAVIGATION_TIMEOUT_MS = 30000;

const frameUrlFrom = (params: Record<string, unknown> | undefined) => {
  const frame = params?.frame as CdpFrameInfo | undefined;
  if (!frame || frame.parentId) return null;
  return typeof frame.url === 'string' ? frame.url : null;
};

const waitForEvent = (
  client: CdpClient,
  method: string,
  sessionId: string,
  timeoutMs: number,
) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(() => {
    client.off(method, listener);
    reject(new Error(`Timed out waiting for ${method}`));
  }, timeoutMs);
  const listener = (_params: Record<string, unknown> | undefined, eventSessionId?: string) => {
    if (eventSessionId !== sessionId) return;
    clearTimeout(timer);
    client.off(method, listener);
    resolve();
  };
  client.on(method, listener);
});

const gotoPage = async (
  deps: CdpPageDeps,
  setUrl: (url: string) => void,
  url: string,
  options?: CdpGotoOptions,
) => {
  const event = options?.waitUntil === 'load' ? 'Page.loadEventFired' : 'Page.domContentEventFired';
  const wait = waitForEvent(deps.client, event, deps.sessionId, NAVIGATION_TIMEOUT_MS).catch(() => undefined);
  await deps.client.send('Page.navigate', { url }, deps.sessionId);
  setUrl(url);
  await wait;
};

export const createCdpPage = (
  deps: CdpPageDeps,
  initialUrl: string,
  openPage: () => Promise<CdpPage>,
): CdpPage => {
  let currentUrl = initialUrl;
  const context = (): CdpBrowserContext => ({ newPage: openPage });
  const keyboard: CdpKeyboard = {
    press: (key: string) => pressKey(deps.client, deps.sessionId, key),
  };
  const evaluateHandle = <Arg>(fn: string | ((arg: Arg) => unknown), arg?: Arg) => {
    const promise = evaluatePageHandle<Arg>(deps.client, deps.sessionId, fn, arg);
    return promise.then((info) => createCdpHandle(deps, info));
  };
  const evaluate = <Arg, R>(fn: string | ((arg: Arg) => R | Promise<R>), arg?: Arg) =>
    evaluatePage<Arg, R>(deps.client, deps.sessionId, fn, arg);
  const gotoUrl = (url: string, options?: CdpGotoOptions) =>
    gotoPage(deps, (next) => { currentUrl = next; }, url, options);
  const closePage = () =>
    deps.client.send('Target.closeTarget', { targetId: deps.targetId }).then(() => undefined);
  const contentPage = () =>
    evaluatePage<undefined, string>(deps.client, deps.sessionId, () => document.documentElement.outerHTML, undefined);
  deps.client.on('Page.frameNavigated', (params, sessionId) => {
    if (sessionId !== deps.sessionId) return;
    const url = frameUrlFrom(params);
    if (url) currentUrl = url;
  });
  return {
    close: closePage,
    content: contentPage,
    context,
    evaluate,
    evaluateHandle,
    goto: gotoUrl,
    keyboard,
    locator: (selector: string): CdpLocator => createCdpLocator(deps, selector),
    screenshot: (options = {}) => captureScreenshot(deps.client, deps.sessionId, options),
    url: () => currentUrl,
    waitForTimeout: (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); }),
  };
};
