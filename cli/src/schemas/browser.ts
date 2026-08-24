import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import type { Page } from 'playwright';

export const authPageShapeSchema = Type.Object({});

export type AuthPage = Pick<Page, 'evaluate' | 'locator' | 'waitForTimeout'>;
export type VisualPage = Pick<Page, 'evaluate' | 'waitForTimeout'>;
export type AuthPageShape = Static<typeof authPageShapeSchema>;
