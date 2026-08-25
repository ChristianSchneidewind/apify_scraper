import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';

export const cdpConnectionSchema = Type.Object({
  url: Type.String(),
});

export const runtimeContextSchema = Type.Object({
  cdp: cdpConnectionSchema,
  cwd: Type.String(),
});

export type CdpConnection = Static<typeof cdpConnectionSchema>;
export type RuntimeContext = Static<typeof runtimeContextSchema>;
