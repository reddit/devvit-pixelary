import React, { useContext } from 'react';
import { LevelUpModal } from './LevelUpModal';
import { useLevelUpClaim } from '../hooks/useLevelUpClaim';
import { context } from '@devvit/web/client';

const LevelUpContext = React.createContext<{
  unclaimedLevel: { level: number } | null;
  hasUnclaimedLevel: boolean;
}>({ unclaimedLevel: null, hasUnclaimedLevel: false });

export function LevelUpProvider({ children }: { children: React.ReactNode }) {
  const { unclaimedLevel, isLoading, claimLevelUp } = useLevelUpClaim();

  const handleClaim = async () => {
    if (unclaimedLevel) {
      await claimLevelUp(unclaimedLevel.level);
    }
  };

  // Don't block if not logged in
  if (!context.userId) {
    return <>{children}</>;
  }

  return (
    <LevelUpContext.Provider
      value={{
        unclaimedLevel,
        hasUnclaimedLevel: !!unclaimedLevel,
      }}
    >
      {children}
      {!isLoading && unclaimedLevel && (
        <LevelUpModal level={unclaimedLevel.level} onClaim={handleClaim} />
      )}
    </LevelUpContext.Provider>
  );
}

export function useHasUnclaimedLevel(): boolean {
  const ctx = useContext(LevelUpContext);
  return ctx.hasUnclaimedLevel;
}
