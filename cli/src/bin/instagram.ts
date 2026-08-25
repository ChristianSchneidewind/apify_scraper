#!/usr/bin/env node
import { runApp } from '../core/app.ts';
import type { CliOutput } from '../schemas/index.ts';
import { renderPlainResult } from '../core/output.ts';
import { exitCodeForResult, failFromReason } from '../core/result.ts';

const renderOutput = (result: CliOutput) => {
  if (process.argv.includes('--json')) return JSON.stringify(result);
  if (process.argv.includes('--plain')) return renderPlainResult(result);
  return result.ok ? result.summary : `ERROR: ${result.summary}`;
};

const writeResult = (result: CliOutput) => {
  if (result.ok && !result.summary) {
    process.exitCode = exitCodeForResult(result);
    return;
  }
  process.stdout.write(`${renderOutput(result)}\n`);
  process.exitCode = exitCodeForResult(result);
};

const main = async () => {
  const settled = await Promise.allSettled([runApp(process.argv)]);
  const result = settled[0]?.status === 'fulfilled'
    ? settled[0].value
    : failFromReason('cli', settled[0]?.reason, 'cli bootstrap failed');
  writeResult(result);
};

void main();
