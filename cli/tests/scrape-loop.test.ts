import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/modules/scrape-comments/extract-from-locator.ts', () => ({
  computeCommentUid: vi.fn(),
  extractCommentFromItem: vi.fn(),
  listCommentRowLocators: vi.fn(),
  listTimeLocators: vi.fn(),
}));
vi.mock('../src/modules/scrape-comments/process-comment.ts', () => ({
  processCommentCandidate: vi.fn(),
}));
vi.mock('../src/modules/scrape-comments/ui-container.ts', () => ({
  getCommentContainer: vi.fn(),
}));
vi.mock('../src/modules/scrape-comments/ui-scroll.ts', () => ({
  scrollCommentContainer: vi.fn(),
}));
vi.mock('../src/modules/scrape-comments/ui-expand.ts', () => ({
  expandAllReplyThreads: vi.fn(),
  expandComments: vi.fn(),
}));
vi.mock('../src/modules/scrape-comments/ui-rescan.ts', () => ({
  rescanComments: vi.fn(),
  resetCommentsToTop: vi.fn(),
}));
vi.mock('../src/modules/scrape-comments/page-setup.ts', () => ({
  openCommentsPanel: vi.fn(),
}));

import {
  computeCommentUid,
  extractCommentFromItem,
  listCommentRowLocators,
  listTimeLocators,
} from '../src/modules/scrape-comments/extract-from-locator.ts';
import { processCommentCandidate } from '../src/modules/scrape-comments/process-comment.ts';
import { getCommentContainer } from '../src/modules/scrape-comments/ui-container.ts';
import { expandAllReplyThreads, expandComments } from '../src/modules/scrape-comments/ui-expand.ts';
import { openCommentsPanel } from '../src/modules/scrape-comments/page-setup.ts';
import { rescanComments, resetCommentsToTop } from '../src/modules/scrape-comments/ui-rescan.ts';
import { scrollCommentContainer } from '../src/modules/scrape-comments/ui-scroll.ts';
import { runCommentScrapeLoop } from '../src/modules/scrape-comments/scrape-loop.ts';

const sampleComment = {
  commentPermalink: '/p/abc/c/1',
  datetime: null,
  screenshotPaths: [] as string[],
  text: 'first',
  timeText: '1h',
  username: 'alice',
  userProfilePath: '/alice/',
};

const buildPage = () => ({
  locator: vi.fn(),
  waitForTimeout: vi.fn().mockResolvedValue(undefined),
});

describe('runCommentScrapeLoop', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(openCommentsPanel).mockResolvedValue(undefined as never);
    vi.mocked(expandComments).mockResolvedValue(0);
    vi.mocked(expandAllReplyThreads).mockResolvedValue(0);
    vi.mocked(rescanComments).mockResolvedValue(undefined as never);
    vi.mocked(resetCommentsToTop).mockResolvedValue({} as never);
  });

  it('deduplicates comments across rounds', async () => {
    const locator = {};
    vi.mocked(listCommentRowLocators)
      .mockResolvedValueOnce([locator as never])
      .mockResolvedValueOnce([locator as never])
      .mockResolvedValueOnce([]);
    vi.mocked(extractCommentFromItem)
      .mockResolvedValueOnce(sampleComment)
      .mockResolvedValueOnce(sampleComment);
    vi.mocked(computeCommentUid)
      .mockResolvedValueOnce('uid-1')
      .mockResolvedValueOnce('uid-1');
    vi.mocked(processCommentCandidate).mockImplementationOnce(async (_page, _locator, state) => {
      state.newInRound = 1;
      return sampleComment as never;
    }).mockImplementationOnce(async (_page, _locator, state) => {
      state.newInRound = 0;
      return null;
    });
    vi.mocked(getCommentContainer).mockResolvedValue({} as never);
    vi.mocked(scrollCommentContainer).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const comments = await runCommentScrapeLoop(buildPage() as never, {
      maxUiRounds: 3,
      outDir: '/tmp/out',
      uiIdleRounds: 2,
    });
    expect(comments).toHaveLength(1);
    expect(comments[0]?.username).toBe('alice');
    expect(resetCommentsToTop).toHaveBeenCalled();
    expect(expandAllReplyThreads).toHaveBeenCalled();
  });

  it('respects maxComments limit', async () => {
    vi.mocked(listCommentRowLocators).mockResolvedValue([{} as never, {} as never]);
    vi.mocked(extractCommentFromItem).mockResolvedValue(sampleComment);
    vi.mocked(computeCommentUid).mockResolvedValue('uid-1');
    vi.mocked(processCommentCandidate)
      .mockImplementationOnce(async (_page, _locator, state) => {
        state.newInRound = 1;
        return sampleComment as never;
      })
      .mockImplementationOnce(async (_page, _locator, state) => {
        state.newInRound = 1;
        return { ...sampleComment, username: 'bob', text: 'second' } as never;
      });
    vi.mocked(getCommentContainer).mockResolvedValue({} as never);
    vi.mocked(scrollCommentContainer).mockResolvedValue(true);

    const comments = await runCommentScrapeLoop(buildPage() as never, {
      maxComments: 1,
      maxUiRounds: 1,
      outDir: '/tmp/out',
    });
    expect(comments).toHaveLength(1);
  });

  it('stops after the first empty capture round', async () => {
    vi.mocked(listCommentRowLocators).mockResolvedValue([] as never[]);
    vi.mocked(listTimeLocators).mockResolvedValue([] as never[]);
    vi.mocked(processCommentCandidate).mockImplementation(async (_page, _locator, state) => {
      state.newInRound = 0;
      return null;
    });
    vi.mocked(getCommentContainer).mockResolvedValue({} as never);
    vi.mocked(scrollCommentContainer).mockResolvedValue(false);

    const comments = await runCommentScrapeLoop(buildPage() as never, {
      maxUiRounds: 4,
      outDir: '/tmp/out',
      uiIdleRounds: 10,
    });

    expect(comments).toHaveLength(0);
  });
});
