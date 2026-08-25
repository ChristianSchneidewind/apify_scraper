import type { CAC } from 'cac';
import { readFlag, readNumberFlag } from '../../core/options.ts';
import type { CommandDescriptor } from '../../schemas/index.ts';
import { runScrapeComments } from './run.ts';

export const configureCommentsCommand = (cli: CAC) => {
  const command = cli.command('scrape comments', 'Scrape Instagram comments');
  command.option('--liker-collection-mode <mode>', 'Reserved compatibility option (collection disabled)');
  command.option('--liker-retry-attempts <n>', 'Reserved compatibility option (collection disabled)');
  command.option('--liker-retry-delay-ms <n>', 'Reserved compatibility option (collection disabled)');
  command.option('--liker-timeout-ms <n>', 'Reserved compatibility option (collection disabled)');
  command.option('--max-comment-likers <n>', 'Reserved compatibility option (collection disabled)');
  command.option('--max-comments <n>', 'Maximum comments to capture (0 = unlimited)');
  command.option('--max-ui-rounds <n>', 'Maximum UI expand/scroll rounds');
  command.option('--out-dir <path>', 'Output directory');
  command.option('--resume <path>', 'Resume from a previous comments checkpoint');
  command.option('--retry-incomplete-likers', 'Reserved compatibility option (collection disabled)');
  command.option('--ui-idle-rounds <n>', 'Stop after N idle UI rounds');
  command.option('--url <url>', 'Instagram post or reel URL');
  return command;
};

export const commentsCommand: CommandDescriptor = {
  booleanFlags: new Set(['--retry-incomplete-likers']),
  buildRequest: (argv, options) => {
    const mode = readFlag(argv, '--liker-collection-mode');
    const attempts = readNumberFlag(argv, '--liker-retry-attempts');
    const delay = readNumberFlag(argv, '--liker-retry-delay-ms');
    const timeout = readNumberFlag(argv, '--liker-timeout-ms');
    const maxLikers = readNumberFlag(argv, '--max-comment-likers');
    const maxComments = readNumberFlag(argv, '--max-comments');
    const maxRounds = readNumberFlag(argv, '--max-ui-rounds');
    const idleRounds = readNumberFlag(argv, '--ui-idle-rounds');
    const outDir = readFlag(argv, '--out-dir');
    const resume = readFlag(argv, '--resume');
    return {
    command: 'scrape.comments',
    options: {
    ...options,
    ...(mode === 'best_effort' || mode === 'strict' ? { likerCollectionMode: mode } : {}),
    ...(attempts !== undefined ? { likerRetryAttempts: attempts } : {}),
    ...(delay !== undefined ? { likerRetryDelayMs: delay } : {}),
    ...(timeout !== undefined ? { likerTimeoutMs: timeout } : {}),
    ...(maxLikers !== undefined ? { maxCommentLikers: maxLikers } : {}),
    ...(maxComments !== undefined ? { maxComments } : {}),
    ...(maxRounds !== undefined ? { maxUiRounds: maxRounds } : {}),
    ...(outDir ? { outDir } : {}),
    ...(resume ? { resume } : {}),
    retryIncompleteLikers: argv.includes('--retry-incomplete-likers'),
    ...(idleRounds !== undefined ? { uiIdleRounds: idleRounds } : {}),
    url: readFlag(argv, '--url'),
    },
    };
  },
  command: 'scrape.comments',
  configure: configureCommentsCommand,
  execute: async (request, context) => {
    if (request.command !== 'scrape.comments') throw new Error('comments request mismatch');
    return runScrapeComments(context, request.options);
  },
  tokens: ['scrape', 'comments'],
  valueFlags: new Set([
    '--liker-collection-mode', '--liker-retry-attempts', '--liker-retry-delay-ms',
    '--liker-timeout-ms', '--max-comment-likers', '--max-comments', '--max-ui-rounds',
    '--out-dir', '--resume', '--ui-idle-rounds', '--url',
  ]),
};
