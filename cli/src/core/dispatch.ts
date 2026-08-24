import { commandDescriptors } from '../modules/registry.ts';
import type { CommandRequest, RuntimeContext } from '../schemas/index.ts';

export const dispatchCommand = (
  request: CommandRequest,
  context: RuntimeContext,
) => {
  const descriptor = commandDescriptors.find((item) => item.command === request.command);
  if (!descriptor) throw new Error(`missing command descriptor: ${request.command}`);
  return descriptor.execute(request, context);
};
