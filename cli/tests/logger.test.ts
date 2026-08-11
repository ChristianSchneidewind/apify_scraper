import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '../src/core/logger.ts';

describe('createLogger', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('writes structured diagnostics in JSON mode', () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    createLogger({ json: true }).info('loaded', { count: 2 });
    expect(write).toHaveBeenCalledWith(expect.stringContaining('"message":"loaded"'));
    expect(write).toHaveBeenCalledWith(expect.stringContaining('"count":2'));
  });

  it('suppresses non-errors in quiet mode', () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logger = createLogger({ quiet: true });
    logger.info('hidden');
    logger.error('visible');
    expect(write).toHaveBeenCalledTimes(1);
  });
});
