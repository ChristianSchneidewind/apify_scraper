import { describe, expect, it, vi } from 'vitest';
import { expandAllReplyThreads, expandComments } from '../src/modules/scrape-comments/ui-expand.ts';
import { getCommentContainer } from '../src/modules/scrape-comments/ui-container.ts';
import { listCommentRowLocators } from '../src/modules/scrape-comments/extract-from-locator.ts';
import { scrollCommentContainer } from '../src/modules/scrape-comments/ui-scroll.ts';
import { prepareCommentsPage, selectNewestCommentSort } from '../src/modules/scrape-comments/page-setup.ts';

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

const buildPage = (loginRequired = false) => ({
  evaluate: vi.fn().mockResolvedValue(undefined),
  locator: vi.fn().mockImplementation((selector: string) => ({
    click: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(selector.includes('input[name') ? Number(loginRequired) : 1),
    elementHandles: vi.fn().mockResolvedValue([]),
  })),
  waitForTimeout: vi.fn().mockResolvedValue(undefined),
});

describe('prepareCommentsPage', () => {
  it('selects newest comments through the browser script', async () => {
    const page = buildPage();
    page.evaluate.mockResolvedValue('selected_newest');

    await expect(selectNewestCommentSort(page as never)).resolves.toBe('selected_newest');
    expect(page.evaluate).toHaveBeenCalledWith(expect.any(Function), expect.stringContaining('newest_option_not_found'));
  });

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

  it('reports an expired Instagram session', async () => {
    await expect(prepareCommentsPage(buildPage(true) as never, 2, 2))
      .rejects.toThrow('Instagram session expired; run auth login first');
  });
});
