import { findCommandDescriptor, profileDirectory } from '../modules/registry.ts';
import type { CliOutput } from '../schemas/index.ts';
import { normalizeArgv, parseCommandRequest, validateNormalizedArgv } from './argv.ts';
import { buildCli } from './cli-definition.ts';
import { createRuntimeContext } from './context.ts';
import { dispatchCommand } from './dispatch.ts';
import { failFromReason, failResult, okResult } from './result.ts';

const dryRunSummary = (command: string) => `dry run: would execute ${command}`;

const runCommand = async (argv: string[]) => {
  const request = parseCommandRequest(argv);
  if (!request) {
    return failResult('cli', 'invalid command input');
  }
  const context = createRuntimeContext(request.options, profileDirectory);
  if (!context) {
    return failResult(request.command, 'invalid runtime context');
  }
  if (request.options.dryRun) {
    return okResult(request.command, dryRunSummary(request.command));
  }
  return dispatchCommand(request, context);
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
  const descriptor = findCommandDescriptor(input);
  const built = buildCli();
  const configured = built.configured.find((item) => item.descriptor === descriptor);
  return configured?.handle?.outputHelp() ?? built.cli.outputHelp();
};

const renderVersion = () => {
  buildCli().cli.outputVersion();
};

const parseCliInput = async (argv: string[]) =>
  validateNormalizedArgv(argv);

const runCommandSafe = async (argv: string[]) => {
  const request = parseCommandRequest(argv);
  if (!request) {
    return failResult('cli', 'invalid command input');
  }
  const settled = await Promise.allSettled([runCommand(argv)]);
  return settled[0]?.status === 'fulfilled'
    ? settled[0].value
    : failFromReason(request.command, settled[0]?.reason, 'command failed');
};

export const runApp = async (argv: string[]): Promise<CliOutput> => {
  if (wantsRenderedHelp(argv)) {
    renderHelp(argv);
    return okResult('cli', '');
  }
  if (wantsRenderedVersion(argv)) {
    renderVersion();
    return okResult('cli', '');
  }
  if (!(await parseCliInput(argv))) {
    return failResult('cli', 'invalid command input');
  }
  return runCommandSafe(argv);
};
