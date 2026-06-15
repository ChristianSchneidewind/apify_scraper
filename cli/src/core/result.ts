import type { CliOutput, CommandName } from '../schemas/index.ts';

const isUsageError = (summary: string) =>
  summary === 'invalid command input' || summary === 'invalid runtime context';

const isBrowserError = (summary: string) =>
  summary.toLowerCase().includes('browser');

const readReasonMessage = (reason: unknown) => {
  if (reason instanceof Error && reason.message) return reason.message;
  return typeof reason === 'string' && reason ? reason : '';
};

export const okResult = (
  command: CommandName,
  summary: string,
): CliOutput => ({ command, details: {}, ok: true, summary });

export const failResult = (
  command: CommandName,
  summary: string,
): CliOutput => ({ command, details: {}, ok: false, summary });

export const failFromReason = (
  command: CommandName,
  reason: unknown,
  fallback: string,
) => failResult(command, readReasonMessage(reason) || fallback);

export const exitCodeForResult = (result: CliOutput) => {
  if (result.ok) return 0;
  if (isUsageError(result.summary)) return 2;
  if (result.command === 'auth.login') {
    return isBrowserError(result.summary) ? 4 : 3;
  }
  if (result.command === 'scrape.comments' || result.command === 'scrape.profiles') {
    return isBrowserError(result.summary) ? 4 : 5;
  }
  return 1;
};
