import { Value } from '@sinclair/typebox/value';
import type { CommandRequest } from '../schemas/index.ts';
import { commandRequestSchema } from '../schemas/index.ts';

const normalizeArgv = (argv: string[]) =>
  argv[0]?.includes('node') ? argv.slice(2) : argv;

const readValue = (argv: string[], index: number) => argv[index + 1] ?? '';

const buildGlobals = (argv: string[]) => ({
  browserProfile: readFlag(argv, '--browser-profile') || 'default',
  cwd: process.cwd(),
  dryRun: argv.includes('--dry-run'),
  json: argv.includes('--json'),
  noColor: argv.includes('--no-color'),
  noInput: argv.includes('--no-input'),
  quiet: argv.includes('--quiet'),
  verbose: argv.includes('--verbose'),
});

const readFlag = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag);
  return index >= 0 ? readValue(argv, index) : '';
};

const buildAuthRequest = (argv: string[]) => ({
  command: 'auth.login',
  options: { ...buildGlobals(argv), headful: !argv.includes('--headless') },
});

const readNumberFlag = (argv: string[], flag: string) => {
  const raw = readFlag(argv, flag);
  if (!raw) {
    return undefined;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
};

const buildCommentsRequest = (argv: string[]) => ({
  command: 'scrape.comments',
  options: {
    ...buildGlobals(argv), headful: argv.includes('--headful'),
    maxComments: readNumberFlag(argv, '--max-comments'),
    outDir: readFlag(argv, '--out-dir') || undefined, url: readFlag(argv, '--url'),
  },
});

const buildProfilesRequest = (argv: string[]) => ({
  command: 'scrape.profiles',
  options: {
    ...buildGlobals(argv), headful: argv.includes('--headful'),
    outDir: readFlag(argv, '--out-dir'), profileSlug: readFlag(argv, '--profile-slug') || undefined,
    url: readFlag(argv, '--url'),
  },
});

const buildRequest = (argv: string[]) => {
  const input = normalizeArgv(argv);
  const key = input.slice(0, 2).join(' ');
  if (key === 'auth login') {
    return buildAuthRequest(input);
  }
  if (key === 'scrape comments') {
    return buildCommentsRequest(input);
  }
  if (key === 'scrape profiles') {
    return buildProfilesRequest(input);
  }
  return null;
};

export const parseCommandRequest = (argv: string[]): CommandRequest | null => {
  const request = buildRequest(argv);
  if (!request) {
    return null;
  }
  return Value.Check(commandRequestSchema, request)
    ? request
    : null;
};
