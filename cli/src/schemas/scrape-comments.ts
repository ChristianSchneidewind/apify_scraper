import type { ElementHandle as PlaywrightElementHandle, JSHandle, Locator, Page } from 'playwright';
import type { RefindCommentPayload } from './scrape-comments-data.ts';

export * from './scrape-comments-data.ts';

export type BrowserHandle = JSHandle<unknown>;
export type TimeLocator = PlaywrightElementHandle<Node>;
export type CommentPage = Pick<Page, 'evaluate' | 'evaluateHandle' | 'locator' | 'waitForTimeout'>;
export type ElementHandle = TimeLocator;
export type ProcessState = {
  count: number;
  highlightFailures?: Map<string, number>;
  lastScreenshotHash: string | null;
  newInRound: number;
  needsLocatorRefresh?: boolean;
  seenLoose: Set<string>;
  seenPermalink: Set<string>;
  seenStrict: Set<string>;
  seenUid: Set<string>;
};
export type ProcessOptions = {
  likerCollectionMode?: 'best_effort' | 'strict';
  likerRetryAttempts?: number;
  likerRetryDelayMs?: number;
  likerTimeoutMs?: number;
  maxCommentLikers: number;
  outDir: string;
  quiet?: boolean;
  sourceUrl?: string;
  verbose?: boolean;
};
export type CommentContainer = string | null;
export type LikersDialogPage = Pick<Page, 'evaluate' | 'keyboard' | 'url' | 'waitForTimeout'>;
export type LikersPage = Page;
export type CapturePage = Pick<Page, 'evaluate' | 'screenshot' | 'url' | 'waitForTimeout'>;
export type DebugPage = Pick<Page, 'content' | 'evaluate' | 'screenshot' | 'url'>;
export type ClickableLocator = Locator;
export type FilterLocator = Locator;
export type DeepLocator = Locator;
export type DeepLinkPage = Page;
export type CaptureDebugLog = (
  outDir: string,
  commentIndex: number,
  stage: string,
  extra?: Record<string, unknown>,
) => Promise<void>;
export type CapturePayloadBase = RefindCommentPayload;
