import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderPlainResult } from '../src/core/output.ts';
import {
  ensureOutputDirectory,
  writeBinaryFile,
  writeJsonFile,
} from '../src/adapters/filesystem/output.ts';

describe('output adapter', () => {
  it('creates output directories', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'ig-cli-'));
    const dir = await ensureOutputDirectory(cwd, 'artifacts/comments');
    expect(dir).toContain('artifacts/comments');
  });

  it('writes json files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ig-cli-'));
    const path = await writeJsonFile(dir, 'comments.json', { ok: true });
    const text = await readFile(path, 'utf8');
    expect(JSON.parse(text)).toEqual({ ok: true });
  });

  it('writes binary files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ig-cli-'));
    const path = await writeBinaryFile(dir, 'shot.bin', new Uint8Array([1, 2, 3]));
    const data = await readFile(path);
    expect(Array.from(data)).toEqual([1, 2, 3]);
  });

  it('renders plain output', () => {
    const output = renderPlainResult({
      command: 'scrape.comments',
      details: { commentsCount: '1', jsonPath: '/tmp/comments.json' },
      ok: true,
      summary: 'scraped 1 comments',
    });
    expect(output).toContain('OK');
    expect(output).toContain('scrape.comments');
    expect(output).toContain('commentsCount=1');
  });
});
