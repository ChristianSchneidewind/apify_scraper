import { cac } from 'cac';
import { runAuthLogin } from '../modules/auth/login.ts';
import { runScrapeComments } from '../modules/scrape-comments/run.ts';
import { runScrapeProfiles } from '../modules/scrape-profiles/run.ts';
import { runScrapeReposts } from '../modules/scrape-reposts/run.ts';
import { normalizeArgv, parseCommandRequest } from './argv.ts';
import { createRuntimeContext } from './context.ts';
import { failFromReason, failResult, okResult } from './result.ts';
import { CLI_VERSION } from './version.ts';

const addGlobalOptions = (command: ReturnType<ReturnType<typeof cac>['command']>) => {
  command.option('--browser-profile <name>', 'Browser profile', { default: 'default' });
  command.option('--cwd <path>', 'Working directory', { default: process.cwd() });
  command.option('--dry-run', 'Dry run mode');
  command.option('--headless', 'Run browser without UI (default is headful)');
  command.option('--json', 'JSON output');
  command.option('--no-color', 'Disable color', { default: false });
  command.option('--no-input', 'Disable prompts', { default: false });
  command.option('--plain', 'Stable line-oriented output');
  command.option('--quiet', 'Quiet output');
  command.option('--verbose', 'Verbose output');
};

const buildCli = () => {
  const cli = cac('instagram');
  const auth = cli.command('auth login', 'Log into Instagram');
  const comments = cli.command('scrape comments', 'Scrape Instagram comments');
  const profiles = cli.command('scrape profiles', 'Scrape Instagram profiles');
  const reposts = cli.command('scrape reposts', 'Capture Instagram profile reposts');
  cli.example('instagram auth login --browser-profile "default"');
  cli.example('instagram scrape comments --url "https://www.instagram.com/p/abc/"');
  cli.example('instagram scrape profiles --url "https://www.instagram.com/nasa/" --profile-slug "nasa" --out-dir "artifacts/profiles" --json');
  cli.help();
  cli.version(CLI_VERSION);
  addGlobalOptions(auth);
  addGlobalOptions(comments);
  addGlobalOptions(profiles);
  addGlobalOptions(reposts);
  comments.option('--liker-collection-mode <mode>', 'Liker collection mode (best_effort|strict)');
  comments.option('--liker-retry-attempts <n>', 'Additional liker collection attempts');
  comments.option('--liker-retry-delay-ms <n>', 'Initial delay between liker retries in milliseconds');
  comments.option('--liker-timeout-ms <n>', 'Liker collection timeout per attempt in milliseconds');
  comments.option('--max-comment-likers <n>', 'Maximum likers per comment (default: all visible; use 0 for unlimited visible)');
  comments.option('--max-comments <n>', 'Maximum comments to capture (0 = unlimited)');
  comments.option('--max-ui-rounds <n>', 'Maximum UI expand/scroll rounds');
  comments.option('--out-dir <path>', 'Output directory');
  comments.option('--resume <path>', 'Resume from a previous comments checkpoint');
  comments.option('--retry-incomplete-likers', 'Retry comments with likes but no collected likers');
  comments.option('--ui-idle-rounds <n>', 'Stop after N idle UI rounds');
  comments.example('instagram scrape comments --url "https://www.instagram.com/p/abc/" --out-dir "artifacts/comments"');
  comments.option('--url <url>', 'Instagram post or reel URL');
  profiles.option('--out-dir <path>', 'Output directory');
  profiles.option('--profile-slug <slug>', 'Profile output slug');
  profiles.example('instagram scrape profiles --url "https://www.instagram.com/nasa/" --profile-slug "nasa" --out-dir "artifacts/profiles" --json');
  profiles.option('--url <url>', 'Instagram profile URL');
  reposts.option('--out-dir <path>', 'Output directory');
  reposts.example('instagram scrape reposts --url "https://www.instagram.com/nasa/" --out-dir "artifacts/reposts"');
  reposts.option('--url <url>', 'Instagram profile URL');
  return { auth, cli, comments, profiles, reposts };
};

const dryRunSummary = (command: string) => `dry run: would execute ${command}`;

const runCommand = async (argv: string[]) => {
  const request = parseCommandRequest(argv);
  if (!request) {
    return failResult('auth.login', 'invalid command input');
  }
  const context = createRuntimeContext(request.options);
  if (!context) {
    return failResult(request.command, 'invalid runtime context');
  }
  if (request.options.dryRun) {
    return okResult(request.command, dryRunSummary(request.command));
  }
  if (request.command === 'auth.login') {
    return runAuthLogin(context, request.options);
  }
  if (request.command === 'scrape.comments') {
    return runScrapeComments(context, request.options);
  }
  if (request.command === 'scrape.profiles') {
    return runScrapeProfiles(context, request.options);
  }
  return runScrapeReposts(context, request.options);
};

const wantsRenderedHelp = (argv: string[]) => {
  const input = normalizeArgv(argv);
  return input.length === 0 || input.includes('--help') || input.includes('-h');
};

const wantsRenderedVersion = (argv: string[]) => {
  const input = normalizeArgv(argv);
  return input.includes('--version') || input.includes('-v');
};

const renderHelp = (argv: string[]) => {
  const input = normalizeArgv(argv);
  const key = input.slice(0, 2).join(' ');
  const built = buildCli();
  if (key === 'auth login') return built.auth.outputHelp();
  if (key === 'scrape comments') return built.comments.outputHelp();
  if (key === 'scrape profiles') return built.profiles.outputHelp();
  if (key === 'scrape reposts') return built.reposts.outputHelp();
  return built.cli.outputHelp();
};

const renderVersion = () => {
  buildCli().cli.outputVersion();
};

const parseCliInput = async (argv: string[]) => {
  const settled = await Promise.allSettled([
    Promise.resolve(buildCli().cli.parse(normalizeArgv(argv), { run: false })),
  ]);
  return settled[0]?.status === 'fulfilled';
};

const runCommandSafe = async (argv: string[]) => {
  const request = parseCommandRequest(argv);
  if (!request) {
    return failResult('auth.login', 'invalid command input');
  }
  const settled = await Promise.allSettled([runCommand(argv)]);
  return settled[0]?.status === 'fulfilled'
    ? settled[0].value
    : failFromReason(request.command, settled[0]?.reason, 'command failed');
};

export const runApp = async (argv: string[]) => {
  if (wantsRenderedHelp(argv)) {
    renderHelp(argv);
    return okResult('auth.login', '');
  }
  if (wantsRenderedVersion(argv)) {
    renderVersion();
    return okResult('auth.login', '');
  }
  if (!(await parseCliInput(argv))) {
    return failResult('auth.login', 'invalid command input');
  }
  return runCommandSafe(argv);
};
