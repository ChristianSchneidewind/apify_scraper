import type { LogDetails, LoggerOptions } from '../schemas/index.ts';

const renderText = (level: string, message: string) => `[${level}] ${message}\n`;

export const createLogger = (options: LoggerOptions) => {
  const emit = (
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    details: LogDetails = {},
  ) => {
    if (options.quiet && level !== 'error') return;
    if (level === 'debug' && !options.verbose) return;
    if (options.json) {
    process.stderr.write(`${JSON.stringify({ details, level, message, ts: new Date().toISOString() })}\n`);
    return;
    }
    process.stderr.write(renderText(level, message));
  };

  return {
    debug: (message: string, details?: LogDetails) => emit('debug', message, details),
    error: (message: string, details?: LogDetails) => emit('error', message, details),
    info: (message: string, details?: LogDetails) => emit('info', message, details),
    warn: (message: string, details?: LogDetails) => emit('warn', message, details),
  };
};
