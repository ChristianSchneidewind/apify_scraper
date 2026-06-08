#!/usr/bin/env node
import { runApp } from '../core/app.ts';

const main = async () => {
  const result = await runApp(process.argv);
  const line = result.ok ? result.summary : `ERROR: ${result.summary}`;
  const output = process.argv.includes('--json')
    ? JSON.stringify(result)
    : line;
  process.stdout.write(`${output}\n`);
  process.exitCode = result.ok ? 0 : 1;
};

void main();
