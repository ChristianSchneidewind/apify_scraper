import { randomBytes } from 'node:crypto';

export const makeUuid7 = () => {
  const tsMs = BigInt(Date.now()) & ((1n << 48n) - 1n);
  const randA = BigInt(Math.floor(Math.random() * 4096));
  const randB = randomBytes(8);
  const value = (tsMs << 80n) | (0x7n << 76n) | (randA << 64n) | (0b10n << 62n)
    | BigInt('0x' + randB.toString('hex'));
  const hex = value.toString(16).padStart(32, '0').slice(-32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

export const makeScreenshotUtc = () =>
  new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');

export const initScreenshotSession = () => ({
  screenshotKeys: [] as string[],
  screenshotPaths: [] as string[],
  screenshotUtc: makeScreenshotUtc(),
  screenshotUuid: makeUuid7(),
});
