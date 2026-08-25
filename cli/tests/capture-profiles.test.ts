import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/adapters/filesystem/output.ts', () => ({
  ensureOutputDirectory: vi.fn(),
  writeBinaryFile: vi.fn(),
  writeJsonFile: vi.fn(),
}));

import {
  ensureOutputDirectory,
  writeBinaryFile,
  writeJsonFile,
} from '../src/adapters/filesystem/output.ts';
import {
  captureProfilePage,
  extractUsernameFromUrl,
  makeProfileRunFolder,
  persistProfileArtifacts,
  resolveProfileSlug,
} from '../src/modules/scrape-profiles/capture.ts';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveProfileSlug', () => {
  it('uses explicit slug when provided', () => {
    expect(resolveProfileSlug('https://www.instagram.com/nasa/', 'custom')).toBe('custom');
  });

  it('derives slug from profile url', () => {
    expect(resolveProfileSlug('https://www.instagram.com/nasa/')).toBe('nasa');
  });
});

describe('extractUsernameFromUrl', () => {
  it('rejects non-profile urls', () => {
    expect(extractUsernameFromUrl('https://www.instagram.com/p/abc/')).toBeNull();
  });
});

describe('makeProfileRunFolder', () => {
  it('includes timestamp and profile slug', () => {
    expect(makeProfileRunFolder('nasa')).toMatch(/^\d{8}T\d{6}Z_nasa$/);
  });
});

describe('captureProfilePage', () => {
  it('waits, extracts profile data, and captures screenshot', async () => {
    const waitForTimeout = vi.fn();
    const evaluate = vi.fn().mockResolvedValue({
      avatarUrl: null,
      biography: 'Bio',
      description: 'desc',
      fullName: 'NASA',
      stats: ['100 posts'],
      title: 'NASA (@nasa)',
      url: 'https://www.instagram.com/nasa/',
      username: 'nasa',
    });
    const screenshot = vi.fn().mockResolvedValue(new Uint8Array([9]));

    const result = await captureProfilePage(
      { evaluate, screenshot, waitForTimeout },
      'https://www.instagram.com/nasa/',
    );

    expect(waitForTimeout).toHaveBeenCalledWith(250);
    expect(waitForTimeout).toHaveBeenCalledWith(3000);
    expect(result.profile.username).toBe('nasa');
    expect(result.profile.sourceUrl).toBe('https://www.instagram.com/nasa/');
    expect(result.screenshot).toEqual(new Uint8Array([9]));
    expect(evaluate).toHaveBeenCalledWith(
      expect.any(Function),
      expect.stringContaining('| profile |'),
    );
  });
});

describe('persistProfileArtifacts', () => {
  it('writes json and png using slug', async () => {
    vi.mocked(ensureOutputDirectory).mockResolvedValue('/tmp/out');
    vi.mocked(writeJsonFile).mockResolvedValue('/tmp/out/nasa.json');
    vi.mocked(writeBinaryFile).mockResolvedValue('/tmp/out/nasa.png');

    const paths = await persistProfileArtifacts(
      '/tmp/project',
      'profiles',
      'nasa',
      {
        avatarUrl: null,
        biography: 'Bio',
        description: 'desc',
        fullName: 'NASA',
        sourceUrl: 'https://www.instagram.com/nasa/',
        stats: [],
        title: 'NASA',
        url: 'https://www.instagram.com/nasa/',
        username: 'nasa',
      },
      new Uint8Array([1, 2]),
    );

    expect(paths.jsonPath).toBe('/tmp/out/nasa.json');
    expect(paths.screenshotPath).toBe('/tmp/out/nasa.png');
  });
});
