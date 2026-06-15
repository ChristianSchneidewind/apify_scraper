import { Value } from '@sinclair/typebox/value';
import type { CommandRequest } from '../schemas/index.ts';
import { commandRequestSchema } from '../schemas/index.ts';

const stripNodePrefix = (argv: string[]) =>
  argv[0]?.includes('node') ? argv.slice(2) : argv;

const stripScriptPath = (argv: string[]) => {
  const first = argv[0] ?? '';
  return /\.(c|m)?tsx?$|\.(c|m)?js$/.test(first)
    ? argv.slice(1)
    : argv;
};

export const normalizeArgv = (argv: string[]) =>
  stripScriptPath(stripNodePrefix(argv));

const readValue = (argv: string[], index: number) => argv[index + 1] ?? '';

const buildGlobals = (argv: string[]) => ({
  browserProfile: readFlag(argv, '--browser-profile') || 'default',
  cwd: readFlag(argv, '--cwd') || process.cwd(),
  dryRun: argv.includes('--dry-run'),
  json: argv.includes('--json'),
  noColor: argv.includes('--no-color'),
  noInput: argv.includes('--no-input'),
  plain: argv.includes('--plain'),
  quiet: argv.includes('--quiet'),
  verbose: argv.includes('--verbose'),
});

const readFlag = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag);
  return index >= 0 ? readValue(argv, index) : '';
};

const buildAuthRequest = (argv: string[]) => ({
  command: 'auth.login',
  options: buildGlobals(argv),
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
    ...buildGlobals(argv),
    likerCollectionMode: readFlag(argv, '--liker-collection-mode') || undefined,
    maxCommentLikers: readNumberFlag(argv, '--max-comment-likers'),
    maxComments: readNumberFlag(argv, '--max-comments'),
    maxUiRounds: readNumberFlag(argv, '--max-ui-rounds'),
    outDir: readFlag(argv, '--out-dir') || undefined,
    uiIdleRounds: readNumberFlag(argv, '--ui-idle-rounds'),
    url: readFlag(argv, '--url'),
  },
});

const buildProfilesRequest = (argv: string[]) => ({
  command: 'scrape.profiles',
  options: {
    ...buildGlobals(argv),
    outDir: readFlag(argv, '--out-dir'), profileSlug: readFlag(argv, '--profile-slug') || undefined,
    url: readFlag(argv, '--url'),
  },
});

const commandIndex = (argv: string[]) =>
  argv.findIndex((value) => value === 'auth' || value === 'scrape');

const buildRequest = (argv: string[]) => {
  const input = normalizeArgv(argv);
  const index = commandIndex(input);
  const key = index < 0 ? '' : input.slice(index, index + 2).join(' ');
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
