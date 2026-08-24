import { describe, expect, it } from 'vitest';
import { createRuntimeContext } from '../src/core/context.ts';

const options = {
  cdpUrl: 'http://127.0.0.1:9222',
  cwd: '/tmp/project',
  dryRun: false,
  headful: true,
  json: false,
  noColor: false,
  noInput: false,
  plain: false,
  quiet: false,
  verbose: false,
};

describe('createRuntimeContext', () => {
  it('builds the cdp connection context', () => {
    const context = createRuntimeContext(options);
    expect(context?.cdp.url).toBe('http://127.0.0.1:9222');
    expect(context?.cwd).toBe('/tmp/project');
  });
});
