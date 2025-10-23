import { useState, useEffect } from 'react';
import { LEVELS } from '@shared/constants';
import { PixelFont } from '@components/PixelFont';
import { IconButton } from '@components/IconButton';
import { trpc } from '@client/trpc/client';
import { PixelSymbol } from '@components/PixelSymbol';
import { useTelemetry } from '@client/hooks/useTelemetry';

interface LevelDetailsProps {
  onClose: () => void;
}

export function LevelDetails({ onClose }: LevelDetailsProps) {
  const { track } = useTelemetry();

  // Track level details view on mount
  useEffect(() => {
    void track('view_level_details');
  }, []);
  // Get user profile to show their actual progress
  const { data: userProfile } = trpc.app.user.getProfile.useQuery(undefined, {
    enabled: true,
  });

  // Calculate initial level index based on user's current level, default to 0 if no profile
  const getInitialLevelIndex = () => {
    if (!userProfile) return 0;
    // Find the level index that matches the user's current level rank
    const levelIndex = LEVELS.findIndex(
      (level) => level.rank === userProfile.level
    );
    return levelIndex >= 0 ? levelIndex : 0;
  };

  const [currentLevelIndex, setCurrentLevelIndex] =
    useState(getInitialLevelIndex);
  const currentLevel = LEVELS[currentLevelIndex]!;

  // Update level index when user profile loads
  useEffect(() => {
    if (userProfile) {
      const levelIndex = LEVELS.findIndex(
        (level) => level.rank === userProfile.level
      );
      if (levelIndex >= 0) {
        setCurrentLevelIndex(levelIndex);
      }
    }
  }, [userProfile]);

  // Calculate progress percentage for the current level being viewed
  const progressPercentage =
    userProfile && currentLevel
      ? Math.max(
          0,
          Math.min(
            100,
            ((userProfile.score - currentLevel.min) /
              (currentLevel.max - currentLevel.min)) *
              100
          )
        )
      : 0;
  const nextLevel = () => {
    if (currentLevelIndex < LEVELS.length - 1) {
      setCurrentLevelIndex(currentLevelIndex + 1);
    }
  };

  const prevLevel = () => {
    if (currentLevelIndex > 0) {
      setCurrentLevelIndex(currentLevelIndex - 1);
    }
  };

  const overMinimum = (userProfile?.score ?? 0) >= currentLevel.min;
  const overMaximum = (userProfile?.score ?? 0) >= currentLevel.max;

  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-start justify-start gap-6 w-full h-full p-6 bg-white pixel-shadow">
        {/* Header */}
        <header className="flex flex-row items-start justify-between gap-2 w-full">
          <div className="flex flex-col items-start justify-start gap-2 flex-1">
            <PixelFont color="var(--color-brand-orangered)">
              {`Level ${currentLevel.rank}`}
            </PixelFont>
            <PixelFont scale={3}>{currentLevel.name}</PixelFont>
          </div>

          <IconButton
            symbol="X"
            onClick={onClose}
            telemetryEvent="click_close_level_details"
          />
        </header>

        {/* XP Bar */}
        <div className="flex flex-col items-start justify-start gap-2 w-full mb-6">
          {/* Progress Bar */}
          <div className="flex w-full h-2 relative bg-black/20">
            <div
              className="absolute left-0 top-0 h-full bg-[var(--color-brand-orangered)] transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {/* Labels */}
          <div className="flex flex-row items-center justify-between w-full">
            <PixelFont
              className={
                overMinimum
                  ? 'text-[var(--color-brand-orangered)]'
                  : 'text-black/40'
              }
            >{`${currentLevel.min} XP`}</PixelFont>
            <PixelFont
              className={
                overMaximum
                  ? 'text-[var(--color-brand-orangered)]'
                  : 'text-black/40'
              }
            >{`${currentLevel.max} XP`}</PixelFont>
            {overMinimum && !overMaximum && (
              <PixelFont
                className={`${
                  overMinimum
                    ? 'text-[var(--color-brand-orangered)]'
                    : 'text-black/40'
                } absolute left-1/2 -translate-x-1/2`}
              >{`${progressPercentage.toFixed(1)}%`}</PixelFont>
            )}
          </div>
        </div>

        {/* Rewards */}
        <PixelFont scale={3}>Rewards:</PixelFont>
        <div className="flex flex-col items-start justify-start gap-2 flex-1 h-full">
          <RewardItem
            reward={`+${currentLevel.extraTime}s drawing time`}
            unlocked={overMinimum}
          />
          <RewardItem
            reward={`Level ${currentLevel.rank} badge`}
            unlocked={overMinimum}
          />
        </div>

        {/* Navigation */}
        <nav className="flex items-center justify-between w-full">
          <IconButton
            symbol="arrow-left"
            onClick={prevLevel}
            disabled={currentLevelIndex === 0}
            telemetryEvent="click_level_prev"
          />
          <IconButton
            symbol="arrow-right"
            onClick={nextLevel}
            disabled={currentLevelIndex === LEVELS.length - 1}
            telemetryEvent="click_level_next"
          />
        </nav>
      </div>
    </main>
  );
}

interface RewardItemProps {
  reward: string;
  unlocked: boolean;
}

function RewardItem(props: RewardItemProps) {
  const { reward, unlocked } = props;
  return (
    <div className="flex flex-row items-center justify-start gap-3">
      <PixelSymbol
        type={unlocked ? 'checkmark' : 'x'}
        className={
          unlocked ? 'text-[var(--color-brand-orangered)]' : 'text-black/20'
        }
      />
      <PixelFont className={unlocked ? 'text-black' : 'text-black/50'}>
        {reward}
      </PixelFont>
    </div>
  );
}
