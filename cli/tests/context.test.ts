import { describe, expect, it } from 'vitest';
import { createRuntimeContext } from '../src/core/context.ts';

const options = {
  browserProfile: 'default',
  cwd: '/tmp/project',
  dryRun: false,
  json: false,
  noColor: false,
  noInput: false,
  plain: false,
  quiet: false,
  verbose: false,
};

describe('createRuntimeContext', () => {
  it('builds browser profile paths', () => {
    const context = createRuntimeContext(options);
    expect(context?.browserProfile.name).toBe('default');
    expect(context?.browserProfile.storageStatePath).toContain(
      '.instagram-cli/profiles/default/storage-state.json',
    );
  });
});
