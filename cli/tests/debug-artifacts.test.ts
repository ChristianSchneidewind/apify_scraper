import { describe, expect, it, vi } from 'vitest';
import { dumpCommentDebugArtifacts } from '../src/modules/scrape-comments/capture/debug.ts';

vi.mock('../src/adapters/filesystem/output.ts', () => ({
  writeBinaryFile: vi.fn(),
  writeJsonFile: vi.fn(),
}));

import { writeBinaryFile, writeJsonFile } from '../src/adapters/filesystem/output.ts';

const buildPage = () => ({
  content: vi.fn().mockResolvedValue('<html></html>'),
  evaluate: vi.fn().mockResolvedValue([{ i: 0 }]),
  screenshot: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  url: vi.fn().mockReturnValue('https://www.instagram.com/p/abc/'),
});

describe('dumpCommentDebugArtifacts', () => {
  it('writes screenshot, html, and dom json artifacts', async () => {
    const page = buildPage();

    await dumpCommentDebugArtifacts(
      page as never,
      '/tmp/out',
      4,
      {
        commentPermalink: '/p/abc/c/1',
        datetime: null,
        text: 'hello',
        timeText: '1h',
        username: 'alice',
        userProfilePath: '/alice/',
      },
      30000,
    );

    expect(writeBinaryFile).toHaveBeenCalledTimes(2);
    expect(writeJsonFile).toHaveBeenCalledOnce();
    expect(page.screenshot).toHaveBeenCalledOnce();
    expect(page.content).toHaveBeenCalledOnce();
    expect(page.evaluate).toHaveBeenCalledOnce();
  });
});
