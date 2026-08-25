import type { RefindCommentPayload } from './scrape-comments-data.ts';
import type { CdpHandle, CdpLocator, CdpPage } from './cdp.ts';

export * from './scrape-comments-data.ts';

export type BrowserHandle = CdpHandle;
export type TimeLocator = CdpHandle;
export type CommentPage = Pick<CdpPage, 'evaluate' | 'evaluateHandle' | 'locator' | 'waitForTimeout'>;
export type ElementHandle = CdpHandle;
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
export type LikersDialogPage = Pick<CdpPage, 'evaluate' | 'keyboard' | 'url' | 'waitForTimeout'>;
export type LikersPage = CdpPage;
export type CapturePage = Pick<CdpPage, 'evaluate' | 'evaluateHandle' | 'locator' | 'screenshot' | 'url' | 'waitForTimeout'>;
export type DebugPage = Pick<CdpPage, 'content' | 'evaluate' | 'screenshot' | 'url'>;
export type ClickableLocator = CdpLocator;
export type FilterLocator = CdpLocator;
export type DeepLocator = CdpLocator;
export type DeepLinkPage = CdpPage;
export type CaptureDebugLog = (
  outDir: string,
  commentIndex: number,
  stage: string,
  extra?: Record<string, unknown>,
) => Promise<void>;
export type CapturePayloadBase = RefindCommentPayload;
