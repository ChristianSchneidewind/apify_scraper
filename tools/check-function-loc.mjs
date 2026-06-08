import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const MAX_LOC = 45;

const listFiles = () => {
  const out = execSync("find cli/src -type f \\( -name '*.ts' -o -name '*.tsx' \\)", {
    encoding: 'utf8',
  }).trim();
  return out ? out.split('\n') : [];
};

const isFunctionStart = (line) => /=>\s*\{|\)\s*\{|function\s+/.test(line);

const countFunctions = (file) => {
  const lines = readFileSync(file, 'utf8').split('\n');
  const violations = [];
  let start = -1;
  let depth = 0;

  lines.forEach((line, index) => {
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;

    if (start === -1 && isFunctionStart(line)) {
      start = index + 1;
      depth = opens - closes;
      return;
    }

    if (start !== -1) {
      depth += opens - closes;
      if (depth <= 0) {
        const loc = index + 1 - start + 1;
        if (loc > MAX_LOC) {
          violations.push(`${file}:${start}-${index + 1}:${loc}`);
        }
        start = -1;
        depth = 0;
      }
    }
  });

  return violations;
};

const violations = listFiles()
  .flatMap((file) => countFunctions(join(process.cwd(), file)));

if (violations.length) {
  console.error('[guardrail] function LOC limit exceeded (>45):');
  violations.forEach((item) => console.error(item));
  process.exit(1);
}

console.log('[guardrail] function LOC OK');
