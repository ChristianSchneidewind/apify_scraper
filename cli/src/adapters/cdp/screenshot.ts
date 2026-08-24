import type { CdpCaptureResult, CdpClient, CdpLayoutMetrics, CdpScreenshotClip, CdpScreenshotOptions } from '../../schemas/index.ts';
import { evaluateExpression } from './evaluate.ts';

const STYLE_ATTR = 'data-cdp-screenshot-style';

const buildInjectedCss = (options: CdpScreenshotOptions) => {
  const parts: string[] = [];
  if (options.animations === 'disabled') {
    parts.push('*,*::before,*::after{animation:none!important;transition:none!important;}');
  }
  if (options.caret === 'hide') parts.push('*{caret-color:transparent!important;}');
  if (options.style) parts.push(options.style);
  return parts.join('\n');
};

const injectStyle = (client: CdpClient, sessionId: string, css: string) =>
  evaluateExpression<boolean>(client, sessionId, `(() => {
const css = ${JSON.stringify(css)};
if (!css) return false;
const tag = document.createElement('style');
tag.setAttribute('${STYLE_ATTR}', '1');
tag.textContent = css;
document.documentElement.appendChild(tag);
return true;
})()`);

const removeStyle = (client: CdpClient, sessionId: string) =>
  evaluateExpression<boolean>(client, sessionId, `(() => {
document.querySelectorAll('[${STYLE_ATTR}]').forEach((node) => node.remove());
return true;
})()`).catch(() => false);

const fullPageClip = async (
  client: CdpClient,
  sessionId: string,
): Promise<CdpScreenshotClip> => {
  const metrics = await client.send<CdpLayoutMetrics>(
    'Page.getLayoutMetrics',
    undefined,
    sessionId,
  );
  const size = metrics.cssContentSize;
  return { height: Math.ceil(size.height), width: Math.ceil(size.width), x: 0, y: 0 };
};

const resolveClip = async (
  client: CdpClient,
  sessionId: string,
  options: CdpScreenshotOptions,
): Promise<CdpScreenshotClip | undefined> => {
  if (options.fullPage) return fullPageClip(client, sessionId);
  return options.clip;
};

const captureRaw = async (
  client: CdpClient,
  sessionId: string,
  clip: CdpScreenshotClip | undefined,
  beyondViewport: boolean,
) => {
  const params: Record<string, unknown> = { captureBeyondViewport: beyondViewport, format: 'png' };
  if (clip) params.clip = { ...clip, scale: 1 };
  const result = await client.send<CdpCaptureResult>('Page.captureScreenshot', params, sessionId);
  return Buffer.from(result.data, 'base64');
};

export const captureScreenshot = async (
  client: CdpClient,
  sessionId: string,
  options: CdpScreenshotOptions,
): Promise<Uint8Array> => {
  const css = buildInjectedCss(options);
  const injected = css ? await injectStyle(client, sessionId, css).catch(() => false) : false;
  try {
    const clip = await resolveClip(client, sessionId, options);
    const beyond = Boolean(options.fullPage || (clip && !options.fullPage));
    return await captureRaw(client, sessionId, clip, beyond);
  } finally {
    if (injected) await removeStyle(client, sessionId);
  }
};
