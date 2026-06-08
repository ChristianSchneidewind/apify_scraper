import type { CliOutput, CommandName } from '../schemas/index.ts';

export const okResult = (
  command: CommandName,
  summary: string,
): CliOutput => ({ command, details: {}, ok: true, summary });

export const failResult = (
  command: CommandName,
  summary: string,
): CliOutput => ({ command, details: {}, ok: false, summary });
