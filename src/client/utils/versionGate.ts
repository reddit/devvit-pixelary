import { context } from '@devvit/web/client';
import { MINIMUM_CLIENT_VERSIONS } from '@client/constants';

/**
 * Checks if the current client version meets the minimum requirements.
 * Returns true if:
 * - Client is undefined (web/Shreddit clients - no native version requirement)
 * - Client version meets or exceeds minimum requirements
 * Returns false if client version is below minimum requirements.
 */
export function isClientVersionSufficient(): boolean {
  const client = context.client;

  // Web/Shreddit clients don't have native versions, so they pass
  if (!client) {
    return true;
  }

  const clientVersion = client.version;
  const minimumVersion =
    client.name === 'IOS'
      ? MINIMUM_CLIENT_VERSIONS.IOS
      : MINIMUM_CLIENT_VERSIONS.ANDROID;

  // Compare year first
  if (clientVersion.yyyy < minimumVersion.yyyy) {
    return false;
  }
  if (clientVersion.yyyy > minimumVersion.yyyy) {
    return true;
  }

  // Same year, compare release
  return clientVersion.release >= minimumVersion.release;
}
