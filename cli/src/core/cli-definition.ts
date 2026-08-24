import { cac } from 'cac';
import type { CAC } from 'cac';
import { cliName, commandDescriptors } from '../modules/registry.ts';
import { CLI_VERSION } from './version.ts';

const addGlobalOptions = (cli: CAC) => {
  cli.option('--browser-profile <name>', 'Browser profile', { default: 'default' });
  cli.option('--cwd <path>', 'Working directory', { default: process.cwd() });
  cli.option('--dry-run', 'Dry run mode');
  cli.option('--headless', 'Run browser without UI (default is headful)');
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
