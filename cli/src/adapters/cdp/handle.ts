import type { CdpElementBox, CdpGetPropertiesResult, CdpHandle, CdpHandleInfo, CdpPageDeps, CdpScreenshotOptions } from '../../schemas/index.ts';
import { callOnObject, callOnObjectHandle, releaseObject } from './evaluate.ts';
import { clickAt } from './input.ts';
import { captureScreenshot } from './screenshot.ts';

const elementBoxBrowser = (el: Element): CdpElementBox => {
  const rect = el.getBoundingClientRect();
  return {
    height: rect.height,
    width: rect.width,
    x: rect.x + window.scrollX,
    y: rect.y + window.scrollY,
  };
};

const scrollIntoViewBrowser = (el: Element) => {
  el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
  return true;
};

const viewportBoxBrowser = (el: Element): CdpElementBox => {
  const rect = el.getBoundingClientRect();
  return { height: rect.height, width: rect.width, x: rect.x, y: rect.y };
};

const requireObjectId = (info: CdpHandleInfo) => {
  if (!info.objectId) throw new Error('CDP handle has no backing object');
  return info.objectId;
};

const getPropertyHandles = async (
  deps: CdpPageDeps,
  objectId: string,
): Promise<Map<string, CdpHandle>> => {
  const result = await deps.client.send<CdpGetPropertiesResult>(
    'Runtime.getProperties',
    { objectId, ownProperties: true },
    deps.sessionId,
  );
  const map = new Map<string, CdpHandle>();
  for (const prop of result.result) {
    if (prop.value?.objectId) map.set(prop.name, createCdpHandle(deps, prop.value));
  }
  return map;
};

const clickHandle = async (deps: CdpPageDeps, objectId: string) => {
  await callOnObject(deps.client, deps.sessionId, objectId, scrollIntoViewBrowser, undefined);
  const box = await callOnObject(deps.client, deps.sessionId, objectId, viewportBoxBrowser, undefined);
  await clickAt(deps.client, deps.sessionId, box.x + box.width / 2, box.y + box.height / 2);
};

const screenshotHandle = async (
  deps: CdpPageDeps,
  objectId: string,
  options: CdpScreenshotOptions,
) => {
  await callOnObject(deps.client, deps.sessionId, objectId, scrollIntoViewBrowser, undefined);
  const box = await callOnObject(deps.client, deps.sessionId, objectId, elementBoxBrowser, undefined);
  return captureScreenshot(deps.client, deps.sessionId, { ...options, clip: box });
};

export const createCdpHandle = (deps: CdpPageDeps, info: CdpHandleInfo): CdpHandle => {
  const objectId = () => requireObjectId(info);
  const dispose = async () => {
    if (info.objectId) await releaseObject(deps.client, deps.sessionId, info.objectId);
  };
  const evaluateHandle = <El, Arg>(fn: string | ((el: El, arg: Arg) => unknown), arg?: Arg) => {
    const promise = callOnObjectHandle<El, Arg>(deps.client, deps.sessionId, objectId(), fn, arg);
    return promise.then((child) => createCdpHandle(deps, child));
  };
  const evaluate = <El, Arg, R>(fn: string | ((el: El, arg: Arg) => R | Promise<R>), arg?: Arg) =>
    callOnObject<El, Arg, R>(deps.client, deps.sessionId, objectId(), fn, arg);
  const scrollIntoView = () => {
    const promise = callOnObject(deps.client, deps.sessionId, objectId(), scrollIntoViewBrowser, undefined);
    return promise.then(() => undefined);
  };
  return {
    asElement: () => (info.subtype === 'node' ? createCdpHandle(deps, info) : null),
    click: () => clickHandle(deps, objectId()),
    dispose,
    evaluate,
    evaluateHandle,
    getProperties: () => getPropertyHandles(deps, objectId()),
    screenshot: (options?: CdpScreenshotOptions) => screenshotHandle(deps, objectId(), options ?? {}),
    scrollIntoViewIfNeeded: scrollIntoView,
  };
};
