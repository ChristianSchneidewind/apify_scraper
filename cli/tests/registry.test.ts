import { describe, expect, it } from 'vitest';
import { buildCli } from '../src/core/cli-definition.ts';
import { parseCommandRequest } from '../src/core/argv.ts';
import { commandDescriptors, findCommandDescriptor } from '../src/modules/registry.ts';

const commands = commandDescriptors.filter((descriptor) => descriptor.tokens.length > 0);

describe('command descriptor registry', () => {
  it('configures every token-based descriptor for help output', () => {
    const configured = buildCli().configured.filter((item) => item.handle);
    expect(configured).toHaveLength(commands.length);
    expect(configured.map((item) => item.descriptor.command))
      .toEqual(commands.map((descriptor) => descriptor.command));
  });

  it.each(commands)('drives matching and parsing for $command', (descriptor) => {
    const argv = [...descriptor.tokens];
    if (descriptor.command === 'scrape.comments') argv.push('--url', 'https://example.com');
    if (descriptor.command === 'scrape.profiles') argv.push('--url', 'https://example.com', '--out-dir', 'out');
    if (descriptor.command === 'scrape.reposts') argv.push('--url', 'https://example.com', '--out-dir', 'out');
    expect(findCommandDescriptor(argv)).toBe(descriptor);
    expect(parseCommandRequest(argv)?.command).toBe(descriptor.command);
  });
});
