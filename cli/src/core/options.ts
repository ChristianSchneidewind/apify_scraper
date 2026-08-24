const stripNodePrefix = (argv: string[]) =>
  argv[0]?.includes('node') ? argv.slice(2) : argv;

const stripScriptPath = (argv: string[]) => {
  const first = argv[0] ?? '';
  return /\.(c|m)?tsx?$|\.(c|m)?js$/.test(first) ? argv.slice(1) : argv;
};

export const normalizeArgv = (argv: string[]) =>
  stripScriptPath(stripNodePrefix(argv));

const readValue = (argv: string[], index: number) => argv[index + 1] ?? '';

export const readFlag = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag);
  return index >= 0 ? readValue(argv, index) : '';
};

export const readNumberFlag = (argv: string[], flag: string) => {
  const raw = readFlag(argv, flag);
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
};

export const parseGlobalOptions = (argv: string[]) => ({
  cdpUrl: readFlag(argv, '--cdp-url') || 'http://127.0.0.1:9222',
  cwd: readFlag(argv, '--cwd') || process.cwd(),
  dryRun: argv.includes('--dry-run'),
  headful: !argv.includes('--headless'),
  json: argv.includes('--json'),
  noColor: argv.includes('--no-color'),
  noInput: argv.includes('--no-input'),
  plain: argv.includes('--plain'),
  quiet: argv.includes('--quiet'),
  verbose: argv.includes('--verbose'),
});

export const GLOBAL_VALUE_FLAGS = new Set(['--cdp-url', '--cwd']);
export const GLOBAL_BOOLEAN_FLAGS = new Set([
  '--dry-run', '--headless', '--json', '--no-color', '--no-input',
  '--plain', '--quiet', '--verbose', '--help', '-h', '--version', '-v',
]);
