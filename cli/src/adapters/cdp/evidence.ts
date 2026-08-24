import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { CdpDirEntry, CdpHashedFile, EvidenceLog } from '../../schemas/index.ts';
import { appendTextFile } from '../filesystem/output.ts';

const ACTIONS_FILE = 'actions.ndjson';
const MANIFEST_FILE = 'manifest.json';

const listEntry = async (dir: string, entry: CdpDirEntry): Promise<string[]> => {
  const path = join(dir, entry.name);
  return entry.isDirectory() ? listFiles(path) : [path];
};

const listFiles = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => listEntry(dir, entry)));
  return nested.flat();
};

const hashFile = async (path: string): Promise<CdpHashedFile> => {
  const content = await readFile(path);
  const info = await stat(path);
  return {
    path,
    sha256: createHash('sha256').update(content).digest('hex'),
    size: info.size,
  };
};

const toManifestEntry = (dir: string, entry: CdpHashedFile) => ({
  path: relative(dir, entry.path),
  sha256: entry.sha256,
  size: entry.size,
});

const buildManifest = async (dir: string, runId: string) => {
  const files = (await listFiles(dir)).filter((file) => !file.endsWith(MANIFEST_FILE));
  const entries = await Promise.all(files.map(hashFile));
  return {
    createdUtc: new Date().toISOString(),
    files: entries.map((entry) => toManifestEntry(dir, entry)),
    runId,
  };
};

const writeManifestFile = async (dir: string, runId: string) => {
  const manifest = await buildManifest(dir, runId);
  const path = join(dir, MANIFEST_FILE);
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
  return path;
};

const appendAction = (dir: string, runId: string) =>
  async (entry: Record<string, unknown>) => {
    const line = `${JSON.stringify({ ...entry, runId, ts: new Date().toISOString() })}\n`;
    await appendTextFile(dir, ACTIONS_FILE, line);
  };

export const createEvidenceLog = async (dir: string, runId: string): Promise<EvidenceLog> => {
  await mkdir(dir, { recursive: true });
  return {
    append: appendAction(dir, runId),
    dir,
    runId,
    writeManifest: () => writeManifestFile(dir, runId),
  };
};

export const newRunId = () =>
  `run-${new Date().toISOString().replaceAll(/[-:.]/g, '').replace('T', '-')}`;
