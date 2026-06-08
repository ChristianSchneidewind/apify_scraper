import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const ensureOutputDirectory = async (cwd: string, outDir: string) => {
  const dir = resolve(cwd, outDir);
  await mkdir(dir, { recursive: true });
  return dir;
};

export const writeJsonFile = async (
  dir: string,
  name: string,
  value: unknown,
) => {
  const path = resolve(dir, name);
  await writeFile(path, JSON.stringify(value, null, 2));
  return path;
};

export const writeBinaryFile = async (
  dir: string,
  name: string,
  value: Uint8Array,
) => {
  const path = resolve(dir, name);
  await writeFile(path, value);
  return path;
};
