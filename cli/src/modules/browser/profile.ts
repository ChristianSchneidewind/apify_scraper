import type { BrowserProfile } from '../../schemas/index.ts';

export const formatBrowserProfile = (
  profile: BrowserProfile,
) => `${profile.name}:${profile.storageStatePath}`;
