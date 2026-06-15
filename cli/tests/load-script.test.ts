import { describe, expect, it } from 'vitest';
import {
  browserRunElement,
  browserRunIife,
  browserRunPayload,
  injectHelpers,
  runElementScript,
  runIifeScript,
  runPayloadScript,
} from '../src/adapters/instagram/load-script.ts';

describe('load script helpers', () => {
  it('injects helper source', () => {
    expect(injectHelpers('a__HELPERS__b', 'X')).toBe('aXb');
  });

  it('runs payload scripts', () => {
    const body = 'return (payload) => payload.value + 1;';
    expect(runPayloadScript<number>(body, { value: 2 })).toBe(3);
    expect(browserRunPayload<number>({ body, payload: { value: 4 } })).toBe(5);
  });

  it('runs element scripts', () => {
    const el = { value: 7 } as unknown as Element;
    const body = 'return el.value + 2;';
    expect(runElementScript<number>(body, el)).toBe(9);
    expect(browserRunElement<number>({ body }, el)).toBe(9);
  });

  it('runs iife scripts', () => {
    const body = 'return (() => 6)();';
    expect(runIifeScript<number>(body)).toBe(6);
    expect(browserRunIife({ body })).toBe(6);
  });
});
