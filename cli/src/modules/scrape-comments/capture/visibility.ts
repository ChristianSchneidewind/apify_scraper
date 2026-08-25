import type { ElementHandle, VisibilityQuote } from '../../../schemas/index.ts';
import { createVisibilityTracker, formatVisibilityQuote, isHandleVisible } from '../../../adapters/cdp/verify.ts';

let tracker = createVisibilityTracker();

export const resetVisibilityTracker = () => {
  tracker = createVisibilityTracker();
};

// Action-verify loop for captures: the target must actually be inside the
// viewport before screenshots are taken. Failures are flagged, not dropped,
// so coverage stays at 100% and outliers can be spot-checked afterwards.
export const verifyCaptureVisibility = async (
  handle: ElementHandle,
  id: string,
): Promise<boolean> => {
  const visible = await isHandleVisible(handle);
  tracker.record(id, visible);
  return visible;
};

export const visibilityQuote = (): VisibilityQuote => tracker.quote();

export const visibilitySummary = () => formatVisibilityQuote(tracker.quote());

export const visibilityFlaggedIds = () => tracker.flaggedIds();
