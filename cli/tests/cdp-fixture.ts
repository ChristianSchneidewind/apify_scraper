import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openBrowserSession } from '../src/adapters/cdp/browser.ts';
import type { CdpBrowserSession, CdpPage } from '../src/schemas/index.ts';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH || '',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
];

export type CdpFixture = {
  close: () => Promise<void>;
  page: CdpPage;
  session: CdpBrowserSession;
};

export const findChromeBinary = () =>
  CHROME_CANDIDATES.find((candidate) => candidate && existsSync(candidate)) || null;

const waitForDebugPort = async (userDataDir: string) => {
  const portFile = join(userDataDir, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (existsSync(portFile)) {
      const content = await readFile(portFile, 'utf8');
      const port = Number(content.split('\n')[0]);
      if (Number.isFinite(port) && port > 0) return port;
    }
    await new Promise((resolve) => { setTimeout(resolve, 100); });
  }
  throw new Error('Chrome did not expose a DevTools port in time');
};

const killProcess = (proc: ChildProcess) =>
  new Promise<void>((resolve) => {
    proc.once('exit', () => resolve());
    proc.kill('SIGKILL');
    setTimeout(resolve, 3000);
  });

export const launchCdpFixture = async (): Promise<CdpFixture | null> => {
  const binary = findChromeBinary();
  if (!binary) return null;
  const userDataDir = await mkdtemp(join(tmpdir(), 'cdp-fixture-'));
  const proc = spawn(binary, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], { stdio: 'ignore' });
  try {
    const port = await waitForDebugPort(userDataDir);
    const session = await openBrowserSession({ cdp: { url: `http://127.0.0.1:${port}` }, cwd: userDataDir });
    const close = async () => {
      await session.browser.close();
      await killProcess(proc);
      await rm(userDataDir, { force: true, recursive: true });
    };
    return { close, page: session.page, session };
  } catch (error) {
    await killProcess(proc);
    await rm(userDataDir, { force: true, recursive: true });
    throw error;
  }
};

export const setFixtureContent = (page: CdpPage, html: string) =>
  page.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`, { waitUntil: 'load' });
