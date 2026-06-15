import { resolve } from 'node:path';
import { Value } from '@sinclair/typebox/value';
import type { GlobalOptions, RuntimeContext } from '../schemas/index.ts';
import { runtimeContextSchema } from '../schemas/index.ts';

const buildBrowserProfile = (browserProfile: string, cwd: string) => ({
  dir: resolve(cwd, '.instagram-cli', 'profiles', browserProfile),
  name: browserProfile,
  storageStatePath: resolve(
    cwd,
    '.instagram-cli',
    'profiles',
    browserProfile,
    'storage-state.json',
  ),
});

export const createRuntimeContext = (
  options: GlobalOptions,
): RuntimeContext | null => {
  const context = {
    browserProfile: buildBrowserProfile(options.browserProfile, options.cwd),
    cwd: options.cwd,
  };
  return Value.Check(runtimeContextSchema, context)
    ? context
    : null;
};
