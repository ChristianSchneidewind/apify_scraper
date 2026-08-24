import type { CdpClient, CdpErrorBody, CdpEventListener, CdpEventParams, CdpPendingEntry, CdpRequestParams } from '../../schemas/index.ts';

const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 10));

const openSocket = async (wsUrl: string): Promise<WebSocket> => {
  const socket = new WebSocket(wsUrl);
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true });
    socket.addEventListener('error', () => reject(new Error(`CDP WebSocket failed: ${wsUrl}`)), { once: true });
  });
  return socket;
};

const parseMessage = (data: unknown): Record<string, unknown> | null => {
  if (typeof data !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(data);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const isCdpError = (value: unknown): value is CdpErrorBody =>
  Boolean(value && typeof value === 'object' && 'message' in value);

const createDispatcher = (listeners: Map<string, Set<CdpEventListener>>) =>
  (message: Record<string, unknown>) => {
    const method = typeof message.method === 'string' ? message.method : '';
    const sessionId = typeof message.sessionId === 'string' ? message.sessionId : undefined;
    const params = message.params as CdpEventParams | undefined;
    for (const listener of listeners.get(method) ?? []) listener(params, sessionId);
  };

const createSettler = (pending: Map<number, CdpPendingEntry>) =>
  (message: Record<string, unknown>) => {
    const id = typeof message.id === 'number' ? message.id : -1;
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    if (isCdpError(message.error)) entry.reject(new Error(`CDP error: ${message.error.message}`));
    else entry.resolve(message.result);
  };

const buildRequestMessage = (
  id: number,
  method: string,
  params: CdpRequestParams | undefined,
  sessionId: string | undefined,
) => {
  const message: Record<string, unknown> = { id, method };
  if (params) message.params = params;
  if (sessionId) message.sessionId = sessionId;
  return message;
};

const sendRequest = <R>(
  socket: WebSocket,
  pending: Map<number, CdpPendingEntry>,
  id: number,
  message: Record<string, unknown>,
): Promise<R> => new Promise<R>((resolve, reject) => {
  pending.set(id, { reject, resolve: resolve as (value: unknown) => void });
  socket.send(JSON.stringify(message));
});

export const connectCdp = async (wsUrl: string): Promise<CdpClient> => {
  const socket = await openSocket(wsUrl);
  const pending = new Map<number, CdpPendingEntry>();
  const listeners = new Map<string, Set<CdpEventListener>>();
  const dispatch = createDispatcher(listeners);
  const settle = createSettler(pending);
  let nextId = 0;

  socket.addEventListener('message', (event) => {
    const message = parseMessage(event.data);
    if (!message) return;
    if (typeof message.id === 'number') settle(message);
    else dispatch(message);
  });

  const send = <R>(method: string, params?: CdpRequestParams, sessionId?: string): Promise<R> => {
    nextId += 1;
    const message = buildRequestMessage(nextId, method, params, sessionId);
    return sendRequest<R>(socket, pending, nextId, message);
  };

  const on = (method: string, listener: CdpEventListener) => {
    const set = listeners.get(method) ?? new Set<CdpEventListener>();
    set.add(listener);
    listeners.set(method, set);
  };

  const off = (method: string, listener: CdpEventListener) => {
    listeners.get(method)?.delete(listener);
  };

  const close = async () => {
    for (const entry of pending.values()) entry.reject(new Error('CDP connection closed'));
    pending.clear();
    socket.close();
    await nextFrame();
  };

  return { close, off, on, send };
};
