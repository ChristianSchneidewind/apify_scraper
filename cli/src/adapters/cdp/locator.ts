import type { CdpHandle, CdpHandleFunction, CdpHandleInfo, CdpLocator, CdpPageDeps, CdpScreenshotOptions, CdpSelectorQuery } from '../../schemas/index.ts';
import { callOnObject, callOnObjectHandle, evaluateExpression, evaluateExpressionHandle, releaseObject } from './evaluate.ts';
import { createCdpHandle } from './handle.ts';

const queryAtBrowser = (el: Element, query: CdpSelectorQuery) =>
  el.querySelectorAll(query.selector)[query.index] ?? null;

const queryAllBrowser = (el: Element, selector: string) =>
  Array.from(el.querySelectorAll(selector));

const arrayAtBrowser = (items: unknown[], index: number) => items[index] ?? null;

const arrayLengthBrowser = (items: unknown[]) => items.length;

const documentQueryExpression = (selector: string, index: number) =>
  `(document.querySelectorAll(${JSON.stringify(selector)})[${index}] ?? null)`;

const documentAllExpression = (selector: string) =>
  `Array.from(document.querySelectorAll(${JSON.stringify(selector)}))`;

const requireInfo = (info: CdpHandleInfo, selector: string) => {
  if (!info.objectId) throw new Error(`No element matches selector: ${selector}`);
  return info;
};

const resolveInParent = (
  deps: CdpPageDeps,
  parent: CdpHandleInfo,
  selector: string,
  index: number,
) => {
  const objectId = parent.objectId ?? '';
  return callOnObjectHandle(deps.client, deps.sessionId, objectId, queryAtBrowser, { index, selector });
};

const resolveInfo = async (
  deps: CdpPageDeps,
  selector: string,
  parent: CdpHandleInfo | undefined,
  index: number,
): Promise<CdpHandleInfo> => {
  if (parent?.objectId) {
    const info = await resolveInParent(deps, parent, selector, index);
    return requireInfo(info, selector);
  }
  const info = await evaluateExpressionHandle(deps.client, deps.sessionId, documentQueryExpression(selector, index));
  return requireInfo(info, selector);
};

const resolveArrayInfo = async (
  deps: CdpPageDeps,
  selector: string,
  parent: CdpHandleInfo | undefined,
): Promise<CdpHandleInfo> => {
  if (parent?.objectId) {
    return callOnObjectHandle(deps.client, deps.sessionId, parent.objectId, queryAllBrowser, selector);
  }
  return evaluateExpressionHandle(deps.client, deps.sessionId, documentAllExpression(selector));
};

const collectFromArray = async (
  deps: CdpPageDeps,
  arrayId: string,
): Promise<CdpHandle[]> => {
  const length = await callOnObject(deps.client, deps.sessionId, arrayId, arrayLengthBrowser, undefined);
  const handles: CdpHandle[] = [];
  for (let index = 0; index < length; index += 1) {
    const info = await callOnObjectHandle(deps.client, deps.sessionId, arrayId, arrayAtBrowser, index);
    if (info.objectId) handles.push(createCdpHandle(deps, info));
  }
  return handles;
};

const collectHandles = async (
  deps: CdpPageDeps,
  selector: string,
  parent: CdpHandleInfo | undefined,
): Promise<CdpHandle[]> => {
  const arrayInfo = await resolveArrayInfo(deps, selector, parent);
  if (!arrayInfo.objectId) return [];
  const arrayId = arrayInfo.objectId;
  try {
    return await collectFromArray(deps, arrayId);
  } finally {
    await releaseObject(deps.client, deps.sessionId, arrayId);
  }
};

const countMatches = async (
  deps: CdpPageDeps,
  selector: string,
  parent: CdpHandleInfo | undefined,
) => {
  if (parent?.objectId) {
    const items = await resolveArrayInfo(deps, selector, parent);
    if (!items.objectId) return 0;
    const length = await callOnObject(deps.client, deps.sessionId, items.objectId, arrayLengthBrowser, undefined);
    await releaseObject(deps.client, deps.sessionId, items.objectId);
    return length;
  }
  return evaluateExpression<number>(deps.client, deps.sessionId, `document.querySelectorAll(${JSON.stringify(selector)}).length`);
};

export const createCdpLocator = (
  deps: CdpPageDeps,
  selector: string,
  parent?: CdpHandleInfo,
  index = 0,
): CdpLocator => {
  const handle = async () => createCdpHandle(deps, await resolveInfo(deps, selector, parent, index));
  const evaluate = <El, Arg, R>(fn: CdpHandleFunction<El, Arg, R>, arg?: Arg) =>
    handle().then((resolved) => resolved.evaluate(fn, arg));
  const evaluateHandle = <El, Arg>(fn: CdpHandleFunction<El, Arg, unknown>, arg?: Arg) =>
    handle().then((resolved) => resolved.evaluateHandle(fn, arg));
  return {
    click: async (options) => (await handle()).click(options),
    count: () => countMatches(deps, selector, parent),
    elementHandles: () => collectHandles(deps, selector, parent),
    evaluate,
    evaluateHandle,
    first: () => createCdpLocator(deps, selector, parent, 0),
    locator: (nested: string) => createCdpLocator(deps, `${selector} ${nested}`, parent),
    nth: (next: number) => createCdpLocator(deps, selector, parent, next),
    screenshot: async (options?: CdpScreenshotOptions) => (await handle()).screenshot(options),
  };
};
