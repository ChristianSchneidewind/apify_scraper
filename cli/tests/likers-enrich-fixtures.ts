import { vi } from 'vitest';

export const baseData = {
  commentLikers: [],
  commentPermalink: '/p/abc/c/1',
  datetime: null,
  likesCount: 0,
  text: 'hello',
  timeText: '1h',
  username: 'alice',
  userProfilePath: '/alice/',
};

export const buildPage = () => {
  const browserContext = { newPage: vi.fn() };
  return {
    close: vi.fn().mockResolvedValue(undefined),
    context: vi.fn(() => browserContext),
    evaluate: vi.fn(),
    keyboard: { press: vi.fn() },
    waitForTimeout: vi.fn(),
  };
};
