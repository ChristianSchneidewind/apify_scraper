import { describe, expect, it, vi } from 'vitest';
import { buildRepostsUrl, captureRepostScreenshots, collectRepostLinks, makeRepostsRunFolder } from '../src/modules/scrape-reposts/run.ts';

describe('reposts', () => {
  it('builds the profile reposts URL', () => {
    expect(buildRepostsUrl('https://www.instagram.com/nasa/')).toBe('https://www.instagram.com/nasa/reposts');
    expect(buildRepostsUrl('https://www.instagram.com/nasa/reposts')).toBe('https://www.instagram.com/nasa/reposts');
  });

  it('collects links from the browser page', async () => {
    const evaluate = vi.fn().mockResolvedValue(['https://www.instagram.com/p/abc/']);
    await expect(collectRepostLinks({ evaluate })).resolves.toEqual(['https://www.instagram.com/p/abc/']);
  });

  it('adds a timestamp and nickname to the run folder', () => {
    expect(makeRepostsRunFolder('nasa')).toMatch(/^\d{8}T\d{6}Z_nasa$/);
  });

  it('captures viewport screenshots from the beginning through the end', async () => {
    const evaluate = vi.fn().mockResolvedValue({
      width: 1200,
      height: 1000,
      viewportHeight: 400,
      scrollY: 0,
    });
    const waitForTimeout = vi.fn().mockResolvedValue(undefined);
    const screenshot = vi.fn()
      .mockResolvedValueOnce(new Uint8Array([1]))
      .mockResolvedValueOnce(new Uint8Array([2]))
      .mockResolvedValueOnce(new Uint8Array([3]));
    const write = vi.fn(async (name: string) => `/tmp/${name}`);

    const paths = await captureRepostScreenshots(
      { evaluate, waitForTimeout, screenshot },
      write,
      'https://www.instagram.com/nasa/reposts',
    );

    expect(paths).toHaveLength(3);
    expect(paths.every((path) => /^\/tmp\/[0-9a-f-]{36}\.png$/.test(path))).toBe(true);
    expect(screenshot).toHaveBeenCalledTimes(3);
    expect(screenshot).toHaveBeenCalledWith({ fullPage: false });
    expect(evaluate).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
      text: expect.stringContaining('repost #1'),
    }));
    expect(evaluate).toHaveBeenCalledTimes(12);
  });
});
