import type { CAC } from 'cac';
import type { CommandDescriptor } from '../../schemas/index.ts';
import { runAuthLogin } from './login.ts';

export const configureAuthCommand = (cli: CAC) =>
  cli.command('auth login', 'Log into Instagram');

export const authCommand: CommandDescriptor = {
  booleanFlags: new Set(),
  buildRequest: (_argv, options) => ({ command: 'auth.login', options }),
  command: 'auth.login',
  configure: configureAuthCommand,
  execute: async (request, context) => {
    if (request.command !== 'auth.login') throw new Error('auth request mismatch');
    return runAuthLogin(context, request.options);
  },
  tokens: ['auth', 'login'],
  valueFlags: new Set(),
};
