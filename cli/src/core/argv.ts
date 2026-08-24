import { Value } from '@sinclair/typebox/value';
import { findCommandDescriptor } from '../modules/registry.ts';
import type { CommandRequest } from '../schemas/index.ts';
import { commandRequestSchema } from '../schemas/index.ts';
import {
  GLOBAL_BOOLEAN_FLAGS,
  GLOBAL_VALUE_FLAGS,
  normalizeArgv,
  parseGlobalOptions,
} from './options.ts';

export { normalizeArgv, parseGlobalOptions } from './options.ts';

export const findCommandIndex = (argv: string[]) => {
  const descriptor = findCommandDescriptor(argv);
  if (!descriptor?.tokens.length) return -1;
  return argv.findIndex((_value, index) =>
    descriptor.tokens.every((token, offset) => argv[index + offset] === token));
};

export const validateNormalizedArgv = (argv: string[]) => {
  const input = normalizeArgv(argv);
  const descriptor = findCommandDescriptor(input);
  if (!descriptor) return false;
  const command = findCommandIndex(input);
  const values = new Set([...GLOBAL_VALUE_FLAGS, ...descriptor.valueFlags]);
  const booleans = new Set([...GLOBAL_BOOLEAN_FLAGS, ...descriptor.booleanFlags]);
  for (let index = 0; index < input.length; index += 1) {
    if (index === command) {
    index += descriptor.tokens.length - 1;
    continue;
    }
    const token = input[index] || '';
    if (booleans.has(token)) continue;
    if (!values.has(token)) return false;
    const value = input[index + 1];
    if (!value || value.startsWith('-')) return false;
    index += 1;
  }
  return true;
};

export const parseCommandRequest = (argv: string[]): CommandRequest | null => {
  const input = normalizeArgv(argv);
  const descriptor = findCommandDescriptor(input);
  if (!descriptor) return null;
  const request = descriptor.buildRequest(input, parseGlobalOptions(input));
  return Value.Check(commandRequestSchema, request) ? request : null;
};
