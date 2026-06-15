import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const listFiles = () => {
  const out = execSync(
    "find cli/src cli/tests -type f \\( -name '*.ts' -o -name '*.tsx' \\)",
    { encoding: 'utf8' },
  ).trim();
  return out ? out.split('\n') : [];
};

const pattern = /\bany\b/;
const violations = [];

for (const file of listFiles()) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (pattern.test(line)) {
      violations.push(`${file}:${index + 1}:${line.trim()}`);
    }
  });
}

if (violations.length) {
  console.error("[guardrail] 'any' usage found:");
  violations.forEach((item) => console.error(item));
  process.exit(1);
}

console.log('[guardrail] no-any OK');
