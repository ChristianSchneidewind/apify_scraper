import type { CdpClient, CdpKeyDefinition } from '../../schemas/index.ts';

const KEY_DEFINITIONS: Record<string, CdpKeyDefinition> = {
  ArrowDown: { code: 'ArrowDown', key: 'ArrowDown', windowsVirtualKeyCode: 40 },
  ArrowUp: { code: 'ArrowUp', key: 'ArrowUp', windowsVirtualKeyCode: 38 },
  End: { code: 'End', key: 'End', windowsVirtualKeyCode: 35 },
  Enter: { code: 'Enter', key: 'Enter', windowsVirtualKeyCode: 13 },
  Escape: { code: 'Escape', key: 'Escape', windowsVirtualKeyCode: 27 },
  Home: { code: 'Home', key: 'Home', windowsVirtualKeyCode: 36 },
  PageDown: { code: 'PageDown', key: 'PageDown', windowsVirtualKeyCode: 34 },
  PageUp: { code: 'PageUp', key: 'PageUp', windowsVirtualKeyCode: 33 },
  Tab: { code: 'Tab', key: 'Tab', windowsVirtualKeyCode: 9 },
};

const dispatchKey = async (
  client: CdpClient,
  sessionId: string,
  type: string,
  definition: CdpKeyDefinition,
) => {
  await client.send('Input.dispatchKeyEvent', {
    code: definition.code,
    key: definition.key,
    type,
    windowsVirtualKeyCode: definition.windowsVirtualKeyCode,
  }, sessionId);
};

export const pressKey = async (client: CdpClient, sessionId: string, key: string) => {
  const definition = KEY_DEFINITIONS[key];
  if (!definition) throw new Error(`Unsupported CDP key: ${key}`);
  await dispatchKey(client, sessionId, 'rawKeyDown', definition);
  await dispatchKey(client, sessionId, 'keyUp', definition);
};

const dispatchMouse = async (
  client: CdpClient,
  sessionId: string,
  type: string,
  x: number,
  y: number,
) => {
  await client.send('Input.dispatchMouseEvent', {
    button: 'left',
    clickCount: 1,
    type,
    x,
    y,
  }, sessionId);
};

export const clickAt = async (
  client: CdpClient,
  sessionId: string,
  x: number,
  y: number,
) => {
  await dispatchMouse(client, sessionId, 'mousePressed', x, y);
  await dispatchMouse(client, sessionId, 'mouseReleased', x, y);
};
