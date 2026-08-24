import { authCommand } from './auth/command.ts';
import { profileCommand } from './profile-command.ts';
import { commentsCommand } from './scrape-comments/command.ts';
import { profilesCommand } from './scrape-profiles/command.ts';
import { repostsCommand } from './scrape-reposts/command.ts';
export const cliName = 'instagram';

export const commandDescriptors = [
  authCommand,
  commentsCommand,
  profilesCommand,
  repostsCommand,
  profileCommand,
];

export const findCommandDescriptor = (argv: string[]) => {
  const descriptor = commandDescriptors.find((candidate) => {
    if (candidate.tokens.length === 0) return false;
    return argv.some((_value, index) =>
    candidate.tokens.every((token, offset) => argv[index + offset] === token));
  });
  if (descriptor) return descriptor;
  return argv.includes('--cdp-url') ? profileCommand : null;
};

