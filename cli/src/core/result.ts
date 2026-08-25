import type { CliErrorCode, CliOutput, CommandName } from '../schemas/index.ts';

const isUsageError = (summary: string) =>
  summary === 'invalid command input' || summary === 'invalid runtime context';

const isBrowserError = (summary: string) =>
  summary.toLowerCase().includes('browser');

const isAuthError = (summary: string) =>
  summary.toLowerCase().includes('auth') || summary.toLowerCase().includes('login');

const readReasonMessage = (reason: unknown) => {
  if (reason instanceof Error && reason.message) return reason.message;
  return typeof reason === 'string' && reason ? reason : '';
};

const errorCodeForSummary = (summary: string): CliErrorCode => {
  if (isUsageError(summary)) return 'USAGE_ERROR';
  if (isBrowserError(summary)) return 'BROWSER_ERROR';
  if (isAuthError(summary)) return 'AUTH_ERROR';
  if (summary.includes('scrape') || summary.includes('capture')) return 'SCRAPE_ERROR';
  return 'INTERNAL_ERROR';
};

export const okResult = (
  command: CommandName,
  summary: string,
): CliOutput => ({ command, details: {}, ok: true, summary });

export const failResult = (
  command: CommandName,
  summary: string,
): CliOutput => ({
  command,
  details: {},
  errorCode: errorCodeForSummary(summary),
  ok: false,
  summary,
});

export const failFromReason = (
  command: CommandName,
  reason: unknown,
  fallback: string,
) => failResult(command, readReasonMessage(reason) || fallback);

export const exitCodeForResult = (result: CliOutput) => {
  if (result.ok) return 0;
  if (result.errorCode === 'USAGE_ERROR') return 2;
  if (result.errorCode === 'BROWSER_ERROR') return 4;
  if (result.errorCode === 'AUTH_ERROR') return 3;
  return 5;
};
