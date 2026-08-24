import type { CommandDescriptor } from '../schemas/index.ts';

export const profileCommand: CommandDescriptor = {
  booleanFlags: new Set(),
  buildRequest: (_argv, options) => ({ command: 'profile.show', options }),
  command: 'profile.show',
  configure: () => null,
  execute: async (_request, context) => ({
    command: 'profile.show',
    details: {
    browserProfile: context.browserProfile.name,
    storageStatePath: context.browserProfile.storageStatePath,
    },
    ok: true,
    summary: `browser profile: ${context.browserProfile.name}`,
  }),
  tokens: [],
  valueFlags: new Set(),
};
