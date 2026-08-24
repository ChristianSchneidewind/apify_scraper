import type { Browser, BrowserContext, Page } from 'playwright';
import type { GlobalOptions } from './commands.ts';
import type { CommentRecord } from './outputs.ts';
import type { CaptureSession, LikersBatch, ProcessOptions, ProcessState } from './scrape-comments.ts';

export type BrowserClosePort = Pick<Browser, 'close'>;
export type LoggerOptions = Partial<Pick<GlobalOptions, 'json' | 'quiet' | 'verbose'>>;
export type LogDetails = Record<string, string | number | boolean>;
export type LoggerPort = {
  debug: (message: string, details?: LogDetails) => void;
  error: (message: string, details?: LogDetails) => void;
  info: (message: string, details?: LogDetails) => void;
  warn: (message: string, details?: LogDetails) => void;
};
export type PromptInput = { isTTY?: boolean } | null | undefined;
export type CommentIdentityInput = Partial<Pick<
  CommentRecord,
  'commentPermalink' | 'datetime' | 'isGifOnly' | 'text' | 'timeText' | 'username'
>>;
export type SeenCommentState = Pick<
  ProcessState,
  'seenLoose' | 'seenPermalink' | 'seenStrict' | 'seenUid'
>;
export type RawCommentLiker = {
  profilePath?: string;
  profileUrl?: string;
  username?: string;
};
export type ScreenshotSessionData = Pick<CaptureSession, 'screenshotUtc' | 'screenshotUuid'>;
export type ProfileReadPage = Pick<Page, 'evaluate'>;
export type ProfileCapturePage = Pick<Page, 'evaluate' | 'screenshot' | 'waitForTimeout'>;
export type RepostReadPage = Pick<Page, 'evaluate'>;
export type RepostScrollPage = Pick<Page, 'evaluate' | 'waitForTimeout'>;
export type RepostCapturePage = Pick<Page, 'evaluate' | 'screenshot' | 'waitForTimeout'>;
export type BinaryWriter = (name: string, bytes: Uint8Array) => Promise<string>;
export type LikerCollectSession = { abort: AbortController };
export type LikerRetryConfig = {
  retryAttempts?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
};
export type LikerAttemptState = {
  likers: Array<{ profileUrl: string; username: string }>;
  noProgressStreak: number;
  stop: boolean;
};
export type LikerBatchDebug = LikersBatch & {
  candidateCount?: number;
  summary?: unknown;
  targetCount?: number;
  targetIndex?: number;
};
export type LikerBrowserContext = Pick<BrowserContext, 'newPage'>;
export type CheckpointProcessOptions = Pick<ProcessOptions, 'outDir' | 'sourceUrl'>;
export type ReplyExpansionPage = Pick<Page, 'evaluate'> & Partial<
  Pick<Page, 'locator' | 'waitForTimeout'>
>;
export type CurrentLikesPage = Pick<Page, 'locator' | 'waitForTimeout'>;
