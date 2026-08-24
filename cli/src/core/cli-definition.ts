import { cac } from 'cac';
import type { CAC } from 'cac';
import { cliName, commandDescriptors } from '../modules/registry.ts';
import { CLI_VERSION } from './version.ts';

const addGlobalOptions = (cli: CAC) => {
  cli.option('--cdp-url <url>', 'Chrome DevTools endpoint of the running Chrome', { default: 'http://127.0.0.1:9222' });
  cli.option('--cwd <path>', 'Working directory', { default: process.cwd() });
  cli.option('--dry-run', 'Dry run mode');
  cli.option('--evidence', 'Write evidence log (actions.ndjson) and a SHA-256 manifest');
  cli.option('--headless', 'Deprecated: CDP mode always uses the running Chrome UI');
  cli.option('--json', 'JSON output');
  cli.option('--no-color', 'Disable color', { default: false });
  cli.option('--no-input', 'Disable prompts', { default: false });
  cli.option('--plain', 'Stable line-oriented output');
  cli.option('--quiet', 'Quiet output');
  cli.option('--verbose', 'Verbose output');
};

export const buildCli = () => {
  const cli = cac(cliName);
  const configured = commandDescriptors.map((descriptor) => ({
    descriptor,
    handle: descriptor.configure(cli),
  }));
  cli.help();
  cli.version(CLI_VERSION);
  addGlobalOptions(cli);
  return { cli, configured };
};
