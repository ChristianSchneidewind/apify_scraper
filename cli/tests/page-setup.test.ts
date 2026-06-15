import { describe, expect, it, vi } from 'vitest';
import { expandAllReplyThreads, expandComments } from '../src/modules/scrape-comments/ui-expand.ts';
import { getCommentContainer } from '../src/modules/scrape-comments/ui-container.ts';
import { listCommentRowLocators } from '../src/modules/scrape-comments/extract-from-locator.ts';
import { scrollCommentContainer } from '../src/modules/scrape-comments/ui-scroll.ts';
import { prepareCommentsPage } from '../src/modules/scrape-comments/page-setup.ts';

vi.mock('../src/modules/scrape-comments/ui-expand.ts', () => ({
  expandAllReplyThreads: vi.fn(),
  expandComments: vi.fn(),
}));
vi.mock('../src/modules/scrape-comments/ui-container.ts', () => ({
  getCommentContainer: vi.fn(),
}));
vi.mock('../src/modules/scrape-comments/extract-from-locator.ts', () => ({
  listCommentRowLocators: vi.fn(),
}));
vi.mock('../src/modules/scrape-comments/ui-scroll.ts', () => ({
  scrollCommentContainer: vi.fn(),
}));

const buildPage = () => ({
  evaluate: vi.fn().mockResolvedValue(undefined),
  locator: vi.fn().mockImplementation(() => ({
    click: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(1),
    elementHandles: vi.fn().mockResolvedValue([]),
  })),
  waitForTimeout: vi.fn().mockResolvedValue(undefined),
});

describe('prepareCommentsPage', () => {
  it('loads comments before capture and resets scroll to top', async () => {
    const page = buildPage();
    vi.mocked(expandComments).mockResolvedValue(2);
    vi.mocked(expandAllReplyThreads).mockResolvedValue(1);
    vi.mocked(getCommentContainer).mockResolvedValue({} as never);
    vi.mocked(scrollCommentContainer).mockResolvedValue(true);
    vi.mocked(listCommentRowLocators).mockResolvedValue([
      { evaluate: vi.fn().mockResolvedValue(true) } as never,
    ]);

    await prepareCommentsPage(page as never, 2, 2);

    expect(expandComments).toHaveBeenCalled();
    expect(expandAllReplyThreads).toHaveBeenCalled();
    expect(scrollCommentContainer).toHaveBeenCalled();
    expect(page.evaluate).toHaveBeenCalled();
    expect(listCommentRowLocators).toHaveBeenCalled();
    expect(page.waitForTimeout).toHaveBeenCalled();
  });
});
