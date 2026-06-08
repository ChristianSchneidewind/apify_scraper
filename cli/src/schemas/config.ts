import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';

export const browserProfileSchema = Type.Object({
  name: Type.String(),
  dir: Type.String(),
  storageStatePath: Type.String(),
});

export const runtimeContextSchema = Type.Object({
  browserProfile: browserProfileSchema,
  cwd: Type.String(),
});

export type BrowserProfile = Static<typeof browserProfileSchema>;
export type RuntimeContext = Static<typeof runtimeContextSchema>;
