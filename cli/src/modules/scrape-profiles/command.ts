import type { CAC } from 'cac';
import { readFlag } from '../../core/options.ts';
import type { CommandDescriptor } from '../../schemas/index.ts';
import { runScrapeProfiles } from './run.ts';

export const configureProfilesCommand = (cli: CAC) => {
  const command = cli.command('scrape profiles', 'Scrape Instagram profiles');
  command.option('--out-dir <path>', 'Output directory');
  command.option('--profile-slug <slug>', 'Profile output slug');
  command.option('--url <url>', 'Instagram profile URL');
  return command;
};

export const profilesCommand: CommandDescriptor = {
  booleanFlags: new Set(),
  buildRequest: (argv, options) => {
    const profileSlug = readFlag(argv, '--profile-slug');
    return {
    command: 'scrape.profiles',
    options: {
    ...options,
    outDir: readFlag(argv, '--out-dir'),
    ...(profileSlug ? { profileSlug } : {}),
    url: readFlag(argv, '--url'),
    },
    };
  },
  command: 'scrape.profiles',
  configure: configureProfilesCommand,
  execute: async (request, context) => {
    if (request.command !== 'scrape.profiles') throw new Error('profiles request mismatch');
    return runScrapeProfiles(context, request.options);
  },
  tokens: ['scrape', 'profiles'],
  valueFlags: new Set(['--out-dir', '--profile-slug', '--url']),
};
