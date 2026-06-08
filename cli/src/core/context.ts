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
): RuntimeContext => {
  const context = {
    browserProfile: buildBrowserProfile(options.browserProfile, options.cwd),
    cwd: options.cwd,
  };
  if (!Value.Check(runtimeContextSchema, context)) {
    throw new Error('invalid runtime context');
  }
  return context;
};
