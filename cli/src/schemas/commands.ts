import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';

export const commandNameSchema = Type.Union([
  Type.Literal('auth.login'),
  Type.Literal('scrape.comments'),
  Type.Literal('scrape.profiles'),
  Type.Literal('scrape.reposts'),
]);

export const globalOptionsSchema = Type.Object({
  browserProfile: Type.String({ default: 'default' }),
  cwd: Type.String(),
  dryRun: Type.Boolean({ default: false }),
  headful: Type.Boolean({ default: true }),
  json: Type.Boolean({ default: false }),
  noColor: Type.Boolean({ default: false }),
  plain: Type.Boolean({ default: false }),
  noInput: Type.Boolean({ default: false }),
  quiet: Type.Boolean({ default: false }),
  verbose: Type.Boolean({ default: false }),
});

export const authLoginOptionsSchema = globalOptionsSchema;

export const scrapeCommentsOptionsSchema = Type.Composite([
  globalOptionsSchema,
  Type.Object({
    likerCollectionMode: Type.Optional(Type.Union([Type.Literal('best_effort'), Type.Literal('strict')])),
    likerRetryAttempts: Type.Optional(Type.Number({ minimum: 0 })),
    likerRetryDelayMs: Type.Optional(Type.Number({ minimum: 0 })),
    likerTimeoutMs: Type.Optional(Type.Number({ minimum: 1000 })),
    maxCommentLikers: Type.Optional(Type.Number({ minimum: 0 })),
    maxComments: Type.Optional(Type.Number({ minimum: 0 })),
    maxUiRounds: Type.Optional(Type.Number({ minimum: 1 })),
    outDir: Type.Optional(Type.String({ minLength: 1 })),
    resume: Type.Optional(Type.String({ minLength: 1 })),
    retryIncompleteLikers: Type.Optional(Type.Boolean()),
    uiIdleRounds: Type.Optional(Type.Number({ minimum: 1 })),
    url: Type.String({ minLength: 1 }),
  }),
]);

export const scrapeRepostsOptionsSchema = Type.Composite([
  globalOptionsSchema,
  Type.Object({
    outDir: Type.String({ minLength: 1 }),
    url: Type.String({ minLength: 1 }),
  }),
]);

export const scrapeProfilesOptionsSchema = Type.Composite([
  globalOptionsSchema,
  Type.Object({
    outDir: Type.String({ minLength: 1 }),
    profileSlug: Type.Optional(Type.String({ minLength: 1 })),
    url: Type.String({ minLength: 1 }),
  }),
]);

export const authLoginRequestSchema = Type.Object({
  command: Type.Literal('auth.login'),
  options: authLoginOptionsSchema,
});

export const scrapeCommentsRequestSchema = Type.Object({
  command: Type.Literal('scrape.comments'),
  options: scrapeCommentsOptionsSchema,
});

export const scrapeProfilesRequestSchema = Type.Object({
  command: Type.Literal('scrape.profiles'),
  options: scrapeProfilesOptionsSchema,
});

export const scrapeRepostsRequestSchema = Type.Object({
  command: Type.Literal('scrape.reposts'),
  options: scrapeRepostsOptionsSchema,
});

export const commandRequestSchema = Type.Union([
  authLoginRequestSchema,
  scrapeCommentsRequestSchema,
  scrapeProfilesRequestSchema,
  scrapeRepostsRequestSchema,
]);

export type CommandName = Static<typeof commandNameSchema>;
export type GlobalOptions = Static<typeof globalOptionsSchema>;
export type AuthLoginOptions = Static<typeof authLoginOptionsSchema>;
export type ScrapeCommentsOptions = Static<typeof scrapeCommentsOptionsSchema>;
export type ScrapeProfilesOptions = Static<typeof scrapeProfilesOptionsSchema>;
export type ScrapeRepostsOptions = Static<typeof scrapeRepostsOptionsSchema>;
export type CommandRequest = Static<typeof commandRequestSchema>;
