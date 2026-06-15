import type { CliOutput } from '../schemas/index.ts';

export const renderPlainResult = (result: CliOutput) => {
  const status = result.ok ? 'OK' : 'ERROR';
  const details = Object.entries(result.details)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\t');
  const parts = [status, result.command, result.summary, details].filter(Boolean);
  return parts.join('\t');
};
