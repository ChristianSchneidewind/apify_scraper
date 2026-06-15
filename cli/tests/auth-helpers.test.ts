import { describe, expect, it, vi } from 'vitest';
import { handleCookieBanner, dismissLoginWall } from '../src/adapters/instagram/auth.ts';

describe('auth helpers', () => {
  it('runs cookie banner and login wall scripts', async () => {
    const page = {
      evaluate: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
    };

    await handleCookieBanner(page as never);
    await dismissLoginWall(page as never);

    expect(page.evaluate).toHaveBeenCalledTimes(2);
    expect(page.waitForTimeout).toHaveBeenCalledTimes(2);
  });
});
