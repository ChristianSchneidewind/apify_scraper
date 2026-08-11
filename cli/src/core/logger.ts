const renderText = (level: string, message: string) => `[${level}] ${message}\n`;

export const createLogger = (options: {
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
}) => {
  const emit = (
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    details: Record<string, string | number | boolean> = {},
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
    debug: (message: string, details?: Record<string, string | number | boolean>) => emit('debug', message, details),
    error: (message: string, details?: Record<string, string | number | boolean>) => emit('error', message, details),
    info: (message: string, details?: Record<string, string | number | boolean>) => emit('info', message, details),
    warn: (message: string, details?: Record<string, string | number | boolean>) => emit('warn', message, details),
  };
};
