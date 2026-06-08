import { describe, expect, it, vi } from 'vitest';
import { runCommentScrapeLoop } from '../src/modules/scrape-comments/scrape-loop.ts';

const sampleBatch = [
  {
    commentPermalink: '/p/abc/c/1',
    datetime: null,
    text: 'first',
    timeText: '1h',
    username: 'alice',
    userProfilePath: '/alice/',
  },
];

const buildPage = (batches: Array<typeof sampleBatch>) => {
  let call = 0;
  const evaluate = vi.fn(async (fn: (args: unknown) => unknown) => {
    const source = fn.toString();
    if (source.includes('new Function')) {
      const batch = batches[Math.min(call, batches.length - 1)] || [];
      if (call < batches.length) {
        call += 1;
      }
      return batch;
    }
    if (source.includes('querySelectorAll(\'button')) {
      return 0;
    }
    if (source.includes('scrollTop')) {
      return true;
    }
    return null;
  });
  return {
    evaluate,
    waitForTimeout: vi.fn(),
  };
};

describe('runCommentScrapeLoop', () => {
  it('deduplicates comments across rounds', async () => {
    const page = buildPage([sampleBatch, sampleBatch, []]);
    const comments = await runCommentScrapeLoop(page as never, {
      maxUiRounds: 3,
      uiIdleRounds: 2,
    });
    expect(comments).toHaveLength(1);
    expect(comments[0]?.username).toBe('alice');
  });

  it('respects maxComments limit', async () => {
    const page = buildPage([
      sampleBatch,
      [{
        commentPermalink: '/p/abc/c/2',
        datetime: null,
        text: 'second',
        timeText: '2h',
        username: 'bob',
        userProfilePath: '/bob/',
      }],
    ]);
    const comments = await runCommentScrapeLoop(page as never, { maxComments: 1, maxUiRounds: 2 });
    expect(comments).toHaveLength(1);
  });
});
