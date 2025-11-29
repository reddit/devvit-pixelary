import { useState, useEffect, type ReactNode } from 'react';

import { Text } from './PixelFont';
import { isClientVersionSufficient } from '@client/utils/versionGate';
import { useTelemetry } from '@client/hooks/useTelemetry';

type VersionGateProps = {
  children: ReactNode;
};

export function VersionGate({ children }: VersionGateProps) {
  const [isVersionSufficient, setIsVersionSufficient] = useState<
    boolean | null
  >(null);
  const { track } = useTelemetry();

  useEffect(() => {
    const sufficient = isClientVersionSufficient();
    setIsVersionSufficient(sufficient);
  }, []);

  useEffect(() => {
    if (isVersionSufficient === false) {
      void track('view_version_gate');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVersionSufficient]);

  // Don't render children until we've checked the version
  if (isVersionSufficient === null) {
    return null;
  }

  // Show upgrade modal if version is insufficient
  if (!isVersionSufficient) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 h-full bg-orangered">
        <Text scale={12} className="text-white">
          !
        </Text>

        <div className="flex flex-col items-center justify-center gap-1 text-white">
          <Text scale={3} className="text-white">
            Please update
          </Text>
          <Text scale={3} className="text-white">
            the Reddit app
          </Text>
        </div>

        <div className="flex flex-col items-center justify-center gap-1 text-white">
          <Text>Your app is too old</Text>
          <Text>to play Pixelary</Text>
        </div>
      </div>
    );
  }

  // Version is sufficient, render children
  return <>{children}</>;
}
