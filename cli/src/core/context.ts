import { resolve } from 'node:path';
import { Value } from '@sinclair/typebox/value';
import type { GlobalOptions, RuntimeContext } from '../schemas/index.ts';
import { runtimeContextSchema } from '../schemas/index.ts';

export const createRuntimeContext = (
  options: GlobalOptions,
  profileDirectory: string,
): RuntimeContext | null => {
  const root = resolve(options.cwd, profileDirectory, 'profiles', options.browserProfile);
  const context = {
    browserProfile: {
    dir: root,
    name: options.browserProfile,
    storageStatePath: resolve(root, 'storage-state.json'),
    },
    cwd: options.cwd,
  };
  return Value.Check(runtimeContextSchema, context) ? context : null;
};
