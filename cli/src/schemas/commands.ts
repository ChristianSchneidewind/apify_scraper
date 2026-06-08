import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';

export const commandNameSchema = Type.Union([
  Type.Literal('auth.login'),
  Type.Literal('scrape.comments'),
  Type.Literal('scrape.profiles'),
]);

export const globalOptionsSchema = Type.Object({
  browserProfile: Type.String({ default: 'default' }),
  cwd: Type.String(),
  dryRun: Type.Boolean({ default: false }),
  json: Type.Boolean({ default: false }),
  noColor: Type.Boolean({ default: false }),
  noInput: Type.Boolean({ default: false }),
  quiet: Type.Boolean({ default: false }),
  verbose: Type.Boolean({ default: false }),
});

export const authLoginOptionsSchema = Type.Composite([
  globalOptionsSchema,
  Type.Object({
    headful: Type.Boolean({ default: true }),
  }),
]);

export const scrapeCommentsOptionsSchema = Type.Composite([
  globalOptionsSchema,
  Type.Object({
    headful: Type.Boolean({ default: false }),
    maxComments: Type.Optional(Type.Number({ minimum: 0 })),
    outDir: Type.Optional(Type.String({ minLength: 1 })),
    url: Type.String({ minLength: 1 }),
  }),
]);

export const scrapeProfilesOptionsSchema = Type.Composite([
  globalOptionsSchema,
  Type.Object({
    headful: Type.Boolean({ default: false }),
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

export const commandRequestSchema = Type.Union([
  authLoginRequestSchema,
  scrapeCommentsRequestSchema,
  scrapeProfilesRequestSchema,
]);

export type CommandName = Static<typeof commandNameSchema>;
export type GlobalOptions = Static<typeof globalOptionsSchema>;
export type AuthLoginOptions = Static<typeof authLoginOptionsSchema>;
export type ScrapeCommentsOptions = Static<typeof scrapeCommentsOptionsSchema>;
export type ScrapeProfilesOptions = Static<typeof scrapeProfilesOptionsSchema>;
export type CommandRequest = Static<typeof commandRequestSchema>;
