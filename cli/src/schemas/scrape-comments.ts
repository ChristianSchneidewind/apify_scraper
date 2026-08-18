import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import { commentRecordSchema } from './outputs.ts';
import type { CommentRecord } from './outputs.ts';

export const scrapeLoopOptionsSchema = Type.Object({
  likerCollectionMode: Type.Optional(Type.Union([Type.Literal('best_effort'), Type.Literal('strict')])),
  likerRetryAttempts: Type.Optional(Type.Number({ minimum: 0 })),
  likerRetryDelayMs: Type.Optional(Type.Number({ minimum: 0 })),
  likerTimeoutMs: Type.Optional(Type.Number({ minimum: 1000 })),
  maxCommentLikers: Type.Optional(Type.Number({ minimum: 0 })),
  maxComments: Type.Optional(Type.Number({ minimum: 0 })),
  maxUiRounds: Type.Optional(Type.Number({ minimum: 1 })),
  initialComments: Type.Optional(Type.Array(commentRecordSchema)),
  outDir: Type.String({ minLength: 1 }),
  quiet: Type.Optional(Type.Boolean()),
  sourceUrl: Type.Optional(Type.String()),
  retryIncompleteLikers: Type.Optional(Type.Boolean()),
  uiIdleRounds: Type.Optional(Type.Number({ minimum: 1 })),
  verbose: Type.Optional(Type.Boolean()),
});

export type ScrapeLoopOptions = Static<typeof scrapeLoopOptionsSchema>;

export type TimeLocator = {
  click: (opts: { force?: boolean; timeout: number }) => Promise<void>;
  evaluate: <T, A>(fn: (el: Element, args: A) => T, args: A) => Promise<T>;
  evaluateHandle?: <T, A>(fn: (el: Element, args: A) => T, args: A) => Promise<{
    asElement: () => ElementHandle | null;
    dispose: () => Promise<void>;
  }>;
};

export type CommentPage = {
  evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
  evaluateHandle?: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
  locator: (selector: string) => {
    click: (opts: { timeout: number }) => Promise<void>;
    count: () => Promise<number>;
    elementHandles: () => Promise<TimeLocator[]>;
  };
  waitForTimeout: (ms: number) => Promise<void>;
};

export type ElementHandle = {
  evaluate: <T, A>(fn: (el: Element, args: A) => T, args: A) => Promise<T>;
  evaluateHandle?: <T>(fn: (el: Element) => T) => Promise<{
    asElement: () => ElementHandle | null;
    dispose: () => Promise<void>;
  }>;
  screenshot?: (opts: {
    animations?: 'allow' | 'disabled';
    caret?: 'hide' | 'initial';
    style?: string;
    timeout?: number;
  }) => Promise<Uint8Array>;
};

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
  verbose?: boolean;
};

export type CommentContainer = Element | null;

export type LikersDialogPage = {
  evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
  keyboard?: { press: (key: string) => Promise<void> };
  waitForTimeout: (ms: number) => Promise<void>;
};

export type LikersPage = {
  context: { newPage: () => Promise<LikersPage> };
  evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
  keyboard: { press: (key: string) => Promise<void> };
  locator: (selector: string) => { elementHandles: () => Promise<TimeLocator[]> };
  url: () => string;
  waitForTimeout: (ms: number) => Promise<void>;
};

export type CapturePage = {
  evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
  screenshot: (opts: {
    animations?: 'allow' | 'disabled';
    caret?: 'hide' | 'initial';
    clip?: { height: number; width: number; x: number; y: number };
    fullPage: boolean;
    timeout?: number;
  }) => Promise<Uint8Array>;
  url: () => string;
  waitForTimeout: (ms: number) => Promise<void>;
};

export type DebugPage = {
  content: () => Promise<string>;
  evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T>;
  screenshot: (opts: { fullPage: boolean; timeout?: number }) => Promise<Uint8Array>;
  url?: () => string;
};

export type HighlightResult = {
  detachedFallbackUsed?: boolean;
  expandedForAvatar?: boolean;
  isPostPage?: boolean;
  ok?: boolean;
  reason?: string;
  rowTag?: string;
  rowText?: string;
  selectedTag?: string;
  selectedText?: string;
};

export type OpenLikesResult = {
  clicked?: boolean;
  likesCount?: number;
  ok?: boolean;
  reason?: string;
};

export type LikersBatch = {
  canScroll?: boolean;
  items?: Array<{ profilePath?: string; profileUrl?: string; username?: string }>;
  open?: boolean;
};

export type MultipartPlanResult = {
  metrics?: {
    hasInnerScroll?: boolean;
    overflow?: number;
    rowHeight?: number;
    visibleH?: number;
  };
  mode?: string;
  ok?: boolean;
  sig?: string | null;
  tops?: number[];
};

export type ClickableLocator = {
  click: (opts: { timeout: number }) => Promise<void>;
  scrollIntoViewIfNeeded: (opts: { timeout: number }) => Promise<void>;
};

export type FilterLocator = {
  count: () => Promise<number>;
  filter: (opts: { hasText: RegExp }) => FilterLocator;
  locator: (sel: string) => FilterLocator;
  nth: (index: number) => ClickableLocator;
};

export type DeepLocator = {
  count: () => Promise<number>;
  evaluate: <T, A>(fn: (el: Element, args: A) => T, args: A) => Promise<T>;
  locator: (sel: string) => FilterLocator;
};

export type DeepLinkPage = {
  goto: (url: string, opts: { waitUntil: string }) => Promise<void>;
  locator: (sel: string) => { count: () => Promise<number>; first: DeepLocator };
  waitForTimeout: (ms: number) => Promise<void>;
};

export type EnrichedComment = CommentRecord & { screenshotPaths: string[] };

export type CaptureSession = {
  screenshotKeys: string[];
  screenshotPaths: string[];
  screenshotUtc: string;
  screenshotUuid: string;
};

export type CapturePlan = {
  baseSig?: string | null;
  mode: string;
  plannedParts3plus: number;
  scrollParts: number[];
  totalParts: number;
  use3plusRoute: boolean;
};

export type CapturePartResult = {
  done: boolean;
  lastHash: string | null;
};

export type CaptureDebugLog = (
  outDir: string,
  commentIndex: number,
  stage: string,
  extra?: Record<string, unknown>,
) => Promise<void>;

export type CapturePayloadBase = Record<string, unknown>;

export type MultipartMetrics = {
  hasInnerScroll?: boolean;
  overflow?: number;
  rowHeight?: number;
  visibleH?: number;
};
