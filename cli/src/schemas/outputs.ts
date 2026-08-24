import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import { commandNameSchema } from './commands.ts';

export const jsonObjectSchema = Type.Record(Type.String(), Type.Unknown());

export const screenshotBannerPayloadSchema = Type.Object({
  text: Type.String(),
});

export const commentLikerSchema = Type.Object({
  profileUrl: Type.String(),
  username: Type.String(),
});

export const cliErrorCodeSchema = Type.Union([
  Type.Literal('USAGE_ERROR'),
  Type.Literal('BROWSER_ERROR'),
  Type.Literal('AUTH_ERROR'),
  Type.Literal('SCRAPE_ERROR'),
  Type.Literal('INTERNAL_ERROR'),
]);

export const cliOutputSchema = Type.Object({
  command: commandNameSchema,
  errorCode: Type.Optional(cliErrorCodeSchema),
  ok: Type.Boolean(),
  summary: Type.String(),
  details: Type.Record(Type.String(), Type.String()),
});

export const commentRecordSchema = Type.Object({
  commentDeepLink: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  commentLikers: Type.Optional(Type.Array(commentLikerSchema)),
  commentPermalink: Type.Union([Type.String(), Type.Null()]),
  commentUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  datetime: Type.Union([Type.String(), Type.Null()]),
  index: Type.Optional(Type.Number()),
  isGifOnly: Type.Optional(Type.Boolean()),
  likesCount: Type.Optional(Type.Number()),
  likersComplete: Type.Optional(Type.Boolean()),
  likersReason: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  metadataPath: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  multipartFlagReason: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  multipartNeedsReview: Type.Optional(Type.Boolean()),
  parentCommentPermalink: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  partsTotal: Type.Optional(Type.Number()),
  screenshotKey: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  screenshotKeys: Type.Optional(Type.Array(Type.String())),
  screenshotPath: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  screenshotPaths: Type.Optional(Type.Array(Type.String())),
  sourceUrl: Type.Optional(Type.String()),
  text: Type.String(),
  timeText: Type.String(),
  username: Type.String(),
  userProfilePath: Type.Union([Type.String(), Type.Null()]),
});

export const scrapeCommentsPayloadSchema = Type.Object({
  comments: Type.Array(commentRecordSchema),
  rounds: Type.Number(),
  sourceUrl: Type.String(),
});

export const profilePageDataSchema = Type.Object({
  avatarUrl: Type.Union([Type.String(), Type.Null()]),
  biography: Type.String(),
  description: Type.String(),
  fullName: Type.Union([Type.String(), Type.Null()]),
  sourceUrl: Type.String(),
  stats: Type.Array(Type.String()),
  title: Type.String(),
  url: Type.String(),
  username: Type.Union([Type.String(), Type.Null()]),
});

export type JsonObject = Static<typeof jsonObjectSchema>;
export type ScreenshotBannerPayload = Static<typeof screenshotBannerPayloadSchema>;
export type CliErrorCode = Static<typeof cliErrorCodeSchema>;
export type CliOutput = Static<typeof cliOutputSchema>;
export type CommentLiker = Static<typeof commentLikerSchema>;
export type CommentRecord = Static<typeof commentRecordSchema>;
export type ScrapeCommentsPayload = Static<typeof scrapeCommentsPayloadSchema>;
export type ProfilePageData = Static<typeof profilePageDataSchema>;
