import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import type { CdpPage } from './cdp.ts';

export const authPageShapeSchema = Type.Object({});

export type AuthPage = Pick<CdpPage, 'evaluate' | 'locator' | 'waitForTimeout'>;
export type VisualPage = Pick<CdpPage, 'evaluate' | 'waitForTimeout'>;
export type AuthPageShape = Static<typeof authPageShapeSchema>;
