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

export const buildPage = () => ({
  context: {
    newPage: vi.fn(),
  },
  evaluate: vi.fn(),
  keyboard: { press: vi.fn() },
  waitForTimeout: vi.fn(),
});
