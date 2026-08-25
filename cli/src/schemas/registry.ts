import type { CAC, Command } from 'cac';
import type { CliOutput } from './outputs.ts';
import type { CommandName, CommandRequest, GlobalOptions } from './commands.ts';
import type { RuntimeContext } from './config.ts';

export type CommandDescriptor = {
  booleanFlags: ReadonlySet<string>;
  buildRequest: (argv: string[], options: GlobalOptions) => CommandRequest;
  command: CommandName;
  configure: (cli: CAC) => Command | null;
  execute: (request: CommandRequest, context: RuntimeContext) => Promise<CliOutput>;
  tokens: readonly string[];
  valueFlags: ReadonlySet<string>;
};

export type ConfiguredCommand = {
  descriptor: CommandDescriptor;
  handle: Command | null;
};
