import type { CdpCallResult, CdpClient, CdpHandleInfo, CdpRemoteObject } from '../../schemas/index.ts';

const UNSERIALIZABLE: Record<string, unknown> = {
  '-0': -0,
  Infinity,
  NaN,
  '-Infinity': -Infinity,
};

const toExpression = <Arg, R>(fn: string | ((arg: Arg) => R | Promise<R>), arg: Arg | undefined) => {
  if (typeof fn === 'string') return fn;
  return `(${String(fn)})(${JSON.stringify(arg ?? null)})`;
};

const toFunctionDeclaration = <El, Arg, R>(
  fn: string | ((el: El, arg: Arg) => R | Promise<R>),
) => {
  if (typeof fn === 'string') return `function(){ return (${fn})(this); }`;
  return `function(arg){ return (${String(fn)})(this, arg); }`;
};

const failureFrom = (result: CdpCallResult) => {
  const details = result.exceptionDetails;
  if (!details) return null;
  const description = details.exception?.description || details.text || 'evaluation failed';
  return new Error(`CDP evaluation failed: ${description}`);
};

const unwrapRemote = <R>(remote: CdpRemoteObject): R => {
  if (remote.unserializableValue !== undefined) {
    return UNSERIALIZABLE[remote.unserializableValue] as R;
  }
  return remote.value as R;
};

const throwIfFailed = (result: CdpCallResult) => {
  const failure = failureFrom(result);
  if (failure) throw failure;
};

const handleInfoFrom = (remote: CdpRemoteObject): CdpHandleInfo => {
  const info: CdpHandleInfo = {};
  if (remote.objectId) info.objectId = remote.objectId;
  if (remote.subtype) info.subtype = remote.subtype;
  if (remote.className) info.className = remote.className;
  return info;
};

export const evaluateExpression = async <R>(
  client: CdpClient,
  sessionId: string,
  expression: string,
): Promise<R> => {
  const result = await client.send<CdpCallResult>(
    'Runtime.evaluate',
    { awaitPromise: true, expression, returnByValue: true },
    sessionId,
  );
  throwIfFailed(result);
  return unwrapRemote<R>(result.result);
};

export const evaluateExpressionHandle = async (
  client: CdpClient,
  sessionId: string,
  expression: string,
): Promise<CdpHandleInfo> => {
  const result = await client.send<CdpCallResult>(
    'Runtime.evaluate',
    { awaitPromise: true, expression, returnByValue: false },
    sessionId,
  );
  throwIfFailed(result);
  return handleInfoFrom(result.result);
};

const callParams = (
  objectId: string,
  functionDeclaration: string,
  arg: unknown,
  returnByValue: boolean,
): Record<string, unknown> => ({
  arguments: [{ value: arg ?? null }],
  awaitPromise: true,
  functionDeclaration,
  objectId,
  returnByValue,
});

export const callOnObject = async <El, Arg, R>(
  client: CdpClient,
  sessionId: string,
  objectId: string,
  fn: string | ((el: El, arg: Arg) => R | Promise<R>),
  arg: Arg | undefined,
): Promise<R> => {
  const params = callParams(objectId, toFunctionDeclaration(fn), arg, true);
  const result = await client.send<CdpCallResult>('Runtime.callFunctionOn', params, sessionId);
  throwIfFailed(result);
  return unwrapRemote<R>(result.result);
};

export const callOnObjectHandle = async <El, Arg>(
  client: CdpClient,
  sessionId: string,
  objectId: string,
  fn: string | ((el: El, arg: Arg) => unknown),
  arg: Arg | undefined,
): Promise<CdpHandleInfo> => {
  const params = callParams(objectId, toFunctionDeclaration(fn), arg, false);
  const result = await client.send<CdpCallResult>('Runtime.callFunctionOn', params, sessionId);
  throwIfFailed(result);
  return handleInfoFrom(result.result);
};

export const evaluatePage = <Arg, R>(
  client: CdpClient,
  sessionId: string,
  fn: string | ((arg: Arg) => R | Promise<R>),
  arg: Arg | undefined,
) => evaluateExpression<R>(client, sessionId, toExpression(fn, arg));

export const evaluatePageHandle = <Arg>(
  client: CdpClient,
  sessionId: string,
  fn: string | ((arg: Arg) => unknown),
  arg: Arg | undefined,
) => evaluateExpressionHandle(client, sessionId, toExpression(fn, arg));

export const releaseObject = async (
  client: CdpClient,
  sessionId: string,
  objectId: string,
) => client.send('Runtime.releaseObject', { objectId }, sessionId).catch(() => undefined);
