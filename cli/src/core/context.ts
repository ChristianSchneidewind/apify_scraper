import { Value } from '@sinclair/typebox/value';
import type { GlobalOptions, RuntimeContext } from '../schemas/index.ts';
import { runtimeContextSchema } from '../schemas/index.ts';

export const createRuntimeContext = (options: GlobalOptions): RuntimeContext | null => {
  const context = {
    cdp: { url: options.cdpUrl },
    cwd: options.cwd,
  };
  return Value.Check(runtimeContextSchema, context) ? context : null;
};
