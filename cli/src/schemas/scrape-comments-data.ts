import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import { commentRecordSchema } from './outputs.ts';

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
export const refindCommentPayloadSchema = Type.Object({
  commentPermalink: Type.Union([Type.String(), Type.Null()]),
  text: Type.String(),
  userProfilePath: Type.Union([Type.String(), Type.Null()]),
  username: Type.String(),
});
export const highlightPayloadSchema = Type.Object({
  commentPermalink: Type.Union([Type.String(), Type.Null()]),
  isGifOnly: Type.Boolean(),
  text: Type.String(),
  userProfilePath: Type.Union([Type.String(), Type.Null()]),
  username: Type.String(),
});
export const multipartVerifyPayloadSchema = Type.Object({
  commentPermalink: Type.Union([Type.String(), Type.Null()]),
  mode: Type.String(),
  partsTotal: Type.Number(),
  text: Type.String(),
  top: Type.Number(),
  userProfilePath: Type.Union([Type.String(), Type.Null()]),
  username: Type.String(),
});
export const highlightResultSchema = Type.Object({
  detachedFallbackUsed: Type.Optional(Type.Boolean()),
  expandedForAvatar: Type.Optional(Type.Boolean()),
  isPostPage: Type.Optional(Type.Boolean()),
  ok: Type.Optional(Type.Boolean()),
  reason: Type.Optional(Type.String()),
  rect: Type.Optional(Type.Object({ h: Type.Number(), w: Type.Number() })),
  rowTag: Type.Optional(Type.String()),
  rowText: Type.Optional(Type.String()),
  selectedTag: Type.Optional(Type.String()),
  selectedText: Type.Optional(Type.String()),
});
export const openLikesResultSchema = Type.Object({
  clicked: Type.Optional(Type.Boolean()),
  likesCount: Type.Optional(Type.Number()),
  ok: Type.Optional(Type.Boolean()),
  reason: Type.Optional(Type.String()),
});
export const likerBatchItemSchema = Type.Object({
  profilePath: Type.Optional(Type.String()),
  profileUrl: Type.Optional(Type.String()),
  username: Type.Optional(Type.String()),
});
export const likersBatchSchema = Type.Object({
  canScroll: Type.Optional(Type.Boolean()),
  items: Type.Optional(Type.Array(likerBatchItemSchema)),
  open: Type.Optional(Type.Boolean()),
});
export const multipartMetricsSchema = Type.Object({
  hasInnerScroll: Type.Optional(Type.Boolean()),
  overflow: Type.Optional(Type.Number()),
  rowHeight: Type.Optional(Type.Number()),
  visibleH: Type.Optional(Type.Number()),
});
export const multipartPlanResultSchema = Type.Object({
  metrics: Type.Optional(multipartMetricsSchema),
  mode: Type.Optional(Type.String()),
  ok: Type.Optional(Type.Boolean()),
  sig: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  tops: Type.Optional(Type.Array(Type.Number())),
});
export const enrichedCommentSchema = Type.Intersect([
  commentRecordSchema,
  Type.Object({ screenshotPaths: Type.Array(Type.String()) }),
]);
export const captureSessionSchema = Type.Object({
  dedupedParts: Type.Optional(Type.Number()),
  incompleteReason: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  plannedParts: Type.Optional(Type.Number()),
  screenshotKeys: Type.Array(Type.String()),
  screenshotPaths: Type.Array(Type.String()),
  screenshotUtc: Type.String(),
  screenshotUuid: Type.String(),
});
export const capturePlanSchema = Type.Object({
  baseSig: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  mode: Type.String(),
  plannedParts3plus: Type.Number(),
  scrollParts: Type.Array(Type.Number()),
  totalParts: Type.Number(),
  use3plusRoute: Type.Boolean(),
});
export const capturePartResultSchema = Type.Object({
  done: Type.Boolean(),
  lastHash: Type.Union([Type.String(), Type.Null()]),
  retryable: Type.Optional(Type.Boolean()),
});
export const screenshotClipSchema = Type.Object({
  height: Type.Number(), width: Type.Number(), x: Type.Number(), y: Type.Number(),
});
export const multipartVerifyResultSchema = Type.Object({
  clip: Type.Optional(screenshotClipSchema),
  clippedBottom: Type.Optional(Type.Boolean()),
  clippedTop: Type.Optional(Type.Boolean()),
  maxBottom: Type.Optional(Type.Number()),
  metrics: Type.Optional(multipartMetricsSchema),
  ok: Type.Boolean(),
  reason: Type.Optional(Type.String()),
  rowBottom: Type.Optional(Type.Number()),
  rowTop: Type.Optional(Type.Number()),
});

export type ScrapeLoopOptions = Static<typeof scrapeLoopOptionsSchema>;
export type RefindCommentPayload = Static<typeof refindCommentPayloadSchema>;
export type HighlightPayload = Static<typeof highlightPayloadSchema>;
export type MultipartVerifyPayload = Static<typeof multipartVerifyPayloadSchema>;
export type HighlightResult = Static<typeof highlightResultSchema>;
export type OpenLikesResult = Static<typeof openLikesResultSchema>;
export type LikersBatch = Static<typeof likersBatchSchema>;
export type MultipartPlanResult = Static<typeof multipartPlanResultSchema>;
export type EnrichedComment = Static<typeof enrichedCommentSchema>;
export type CaptureSession = Static<typeof captureSessionSchema>;
export type CapturePlan = Static<typeof capturePlanSchema>;
export type CapturePartResult = Static<typeof capturePartResultSchema>;
export type MultipartMetrics = Static<typeof multipartMetricsSchema>;
export type ScreenshotClip = Static<typeof screenshotClipSchema>;
export type MultipartVerifyResult = Static<typeof multipartVerifyResultSchema>;
