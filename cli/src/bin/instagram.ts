#!/usr/bin/env node
import { runApp } from '../core/app.ts';
import { renderPlainResult } from '../core/output.ts';
import { exitCodeForResult, failFromReason } from '../core/result.ts';

const renderOutput = (result: Awaited<ReturnType<typeof runApp>>) => {
  if (process.argv.includes('--json')) return JSON.stringify(result);
  if (process.argv.includes('--plain')) return renderPlainResult(result);
  return result.ok ? result.summary : `ERROR: ${result.summary}`;
};

const writeResult = (result: Awaited<ReturnType<typeof runApp>>) => {
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
    : failFromReason('auth.login', settled[0]?.reason, 'cli bootstrap failed');
  writeResult(result);
};

void main();
