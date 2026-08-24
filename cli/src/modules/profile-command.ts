import type { CommandDescriptor } from '../schemas/index.ts';

export const profileCommand: CommandDescriptor = {
  booleanFlags: new Set(),
  buildRequest: (_argv, options) => ({ command: 'profile.show', options }),
  command: 'profile.show',
  configure: () => null,
  execute: async (_request, context) => ({
    command: 'profile.show',
    details: {
    cdpUrl: context.cdp.url,
    },
    ok: true,
    summary: `cdp connection: ${context.cdp.url}`,
  }),
  tokens: [],
  valueFlags: new Set(),
};
