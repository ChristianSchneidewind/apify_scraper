import { describe, expect, it, vi } from 'vitest';
import { prepareCommentScreenshotVisuals, prepareProfileScreenshotVisuals } from '../src/adapters/instagram/visual.ts';

describe('prepareProfileScreenshotVisuals', () => {
  it('runs light-mode, overlay, and media freeze prep', async () => {
    const page = {
      evaluate: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
    };

    await prepareProfileScreenshotVisuals(page as never);

    expect(page.evaluate).toHaveBeenCalledTimes(3);
    expect(page.waitForTimeout).toHaveBeenCalledOnce();
  });
});

describe('prepareCommentScreenshotVisuals', () => {
  it('adds viewport fitting for comment screenshots', async () => {
    const page = {
      evaluate: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
    };
    const handle = {
      evaluate: vi.fn().mockResolvedValue(undefined),
    };

    await prepareCommentScreenshotVisuals(page as never, handle as never);

    expect(page.evaluate).toHaveBeenCalledTimes(3);
    expect(handle.evaluate).toHaveBeenCalledTimes(1);
    expect(page.waitForTimeout).toHaveBeenCalledTimes(2);
  });
});
