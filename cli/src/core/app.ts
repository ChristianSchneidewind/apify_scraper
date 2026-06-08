import { cac } from 'cac';
import { runAuthLogin } from '../modules/auth/login.ts';
import { runScrapeComments } from '../modules/scrape-comments/run.ts';
import { runScrapeProfiles } from '../modules/scrape-profiles/run.ts';
import { parseCommandRequest } from './argv.ts';
import { createRuntimeContext } from './context.ts';
import { failResult } from './result.ts';

const addGlobalOptions = (command: ReturnType<ReturnType<typeof cac>['command']>) => {
  command.option('--browser-profile <name>', 'Browser profile', { default: 'default' });
  command.option('--dry-run', 'Dry run mode');
  command.option('--json', 'JSON output');
  command.option('--no-color', 'Disable color');
  command.option('--no-input', 'Disable prompts');
  command.option('--quiet', 'Quiet output');
  command.option('--verbose', 'Verbose output');
};

const buildCli = () => {
  const cli = cac('instagram');
  const auth = cli.command('auth login', 'Log into Instagram');
  const comments = cli.command('scrape comments', 'Scrape Instagram comments');
  const profiles = cli.command('scrape profiles', 'Scrape Instagram profiles');
  cli.help();
  cli.version('0.0.0');
  addGlobalOptions(auth);
  addGlobalOptions(comments);
  addGlobalOptions(profiles);
  auth.option('--headless', 'Run headless');
  comments.option('--headful', 'Run headful');
  comments.option('--max-comments <n>', 'Maximum comments to capture');
  comments.option('--out-dir <path>', 'Output directory');
  comments.option('--url <url>', 'Instagram post or reel URL');
  profiles.option('--headful', 'Run headful');
  profiles.option('--out-dir <path>', 'Output directory');
  profiles.option('--profile-slug <slug>', 'Profile output slug');
  profiles.option('--url <url>', 'Instagram profile URL');
  return cli;
};

const runCommand = async (argv: string[]) => {
  const request = parseCommandRequest(argv);
  if (!request) {
    return failResult('auth.login', 'invalid command input');
  }
  const context = createRuntimeContext(request.options);
  if (request.command === 'auth.login') {
    return runAuthLogin(context, request.options);
  }
  if (request.command === 'scrape.comments') {
    return runScrapeComments(context, request.options);
  }
  return runScrapeProfiles(context, request.options);
};

export const runApp = async (argv: string[]) => {
  const input = argv[0]?.includes('node') ? argv.slice(2) : argv;
  try {
    buildCli().parse(input, { run: false });
    return await runCommand(argv);
  } catch {
    return failResult('auth.login', 'cli bootstrap failed');
  }
};
