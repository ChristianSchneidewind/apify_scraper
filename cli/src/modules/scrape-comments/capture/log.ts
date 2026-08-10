import { appendTextFile } from '../../../adapters/filesystem/output.ts';

export const logCaptureDebug = async (
  outDir: string,
  commentIndex: number,
  stage: string,
  extra?: Record<string, unknown>,
) => {
  const suffix = extra ? ` ${JSON.stringify(extra)}` : '';
  process.stderr.write(`[scrape.comments] comment ${commentIndex}: ${stage}${suffix}\n`);
  try {
    await appendTextFile(outDir, 'capture-debug.jsonl', `${JSON.stringify({ commentIndex, extra: extra ?? null, stage, ts: new Date().toISOString() })}\n`);
  } catch {}
};
