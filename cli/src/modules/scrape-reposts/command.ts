import type { CAC } from 'cac';
import { readFlag } from '../../core/options.ts';
import type { CommandDescriptor } from '../../schemas/index.ts';
import { runScrapeReposts } from './run.ts';

export const configureRepostsCommand = (cli: CAC) => {
  const command = cli.command('scrape reposts', 'Capture Instagram profile reposts');
  command.option('--out-dir <path>', 'Output directory');
  command.option('--url <url>', 'Instagram profile URL');
  return command;
};

export const repostsCommand: CommandDescriptor = {
  booleanFlags: new Set(),
  buildRequest: (argv, options) => ({
    command: 'scrape.reposts',
    options: {
    ...options,
    outDir: readFlag(argv, '--out-dir'),
    url: readFlag(argv, '--url'),
    },
  }),
  command: 'scrape.reposts',
  configure: configureRepostsCommand,
  execute: async (request, context) => {
    if (request.command !== 'scrape.reposts') throw new Error('reposts request mismatch');
    return runScrapeReposts(context, request.options);
  },
  tokens: ['scrape', 'reposts'],
  valueFlags: new Set(['--out-dir', '--url']),
};
