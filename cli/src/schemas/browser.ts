import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';

export const authPageShapeSchema = Type.Object({});

export type AuthPage = {
  evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
  goto: (url: string, options: { waitUntil: string }) => Promise<unknown>;
  locator: (selector: string) => { count: () => Promise<number> };
  waitForTimeout: (ms: number) => Promise<void>;
};

export type AuthPageShape = Static<typeof authPageShapeSchema>;
