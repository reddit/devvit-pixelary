import { useState, useEffect } from 'react';
import { generateLevel, getLevelByScore } from '@shared/utils/progression';
import { abbreviateNumber } from '@shared/utils/numbers';
import { Text, Icon } from '@components/PixelFont';
import { IconButton } from '@components/IconButton';
import { trpc } from '@client/trpc/client';
import { useTelemetry } from '@client/hooks/useTelemetry';
import { getRewardsByLevel, getRewardLabel } from '@shared/rewards';

type LevelDetailsProps = {
  onClose: () => void;
};

export function LevelDetails({ onClose }: LevelDetailsProps) {
  const { track } = useTelemetry();

  // Track level details view on mount
  useEffect(() => {
    void track('view_level_details');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Get user profile to show their actual progress
  const { data: userProfile } = trpc.app.user.getProfile.useQuery(undefined, {
    enabled: true,
  });

  const [currentLevelRank, setCurrentLevelRank] = useState(1);
  const [displayProgress, setDisplayProgress] = useState(0);

  const currentLevel = generateLevel(currentLevelRank);

  // Update level rank when user profile loads
  useEffect(() => {
    if (userProfile) {
      const userLevel = getLevelByScore(userProfile.score);
      setCurrentLevelRank(userLevel.rank);
    }
  }, [userProfile]);

  // Calculate actual progress percentage
  const actualProgressPercentage = userProfile
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

  // Animate progress bar from 0 to actual percentage
  useEffect(() => {
    if (userProfile) {
      // Small delay to ensure smooth animation
      const timer = setTimeout(() => {
        setDisplayProgress(actualProgressPercentage);
      }, 100);
      return () => {
        clearTimeout(timer);
      };
    } else {
      setDisplayProgress(0);
    }
  }, [userProfile, actualProgressPercentage]);

  // Use the animated display progress
  const progressPercentage = displayProgress;
  const nextLevel = () => {
    setCurrentLevelRank(currentLevelRank + 1);
  };

  const prevLevel = () => {
    if (currentLevelRank > 1) {
      setCurrentLevelRank(currentLevelRank - 1);
    }
  };

  const overMinimum = (userProfile?.score ?? 0) >= currentLevel.min;
  const overMaximum = (userProfile?.score ?? 0) >= currentLevel.max;

  return (
    <main className="absolute inset-0 flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-start justify-start gap-6 w-full h-full p-6 bg-white pixel-shadow">
        {/* Header */}
        <header className="flex flex-row items-start justify-between gap-2 w-full">
          <div className="flex flex-col items-start justify-start gap-2 flex-1">
            <Text color="var(--color-orangered)">
              {`Level ${currentLevel.rank}`}
            </Text>
            <Text scale={3}>{currentLevel.name}</Text>
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
              className="absolute left-0 top-0 h-full bg-orangered transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {/* Labels */}
          <div className="flex flex-row items-center justify-between w-full">
            <div className="flex flex-row items-center justify-start gap-3">
              <Text
                className={overMinimum ? 'text-orangered' : 'text-black/40'}
              >
                {abbreviateNumber(
                  overMinimum ? (userProfile?.score ?? 0) : currentLevel.min
                )}
              </Text>
              {overMinimum && !overMaximum && (
                <Text className="text-orangered">
                  ({progressPercentage.toFixed(1)}%)
                </Text>
              )}
            </div>

            <Text className={overMaximum ? 'text-orangered' : 'text-black/40'}>
              {abbreviateNumber(currentLevel.max)}
            </Text>
          </div>
        </div>

        {/* Rewards */}
        <Text scale={3}>Rewards:</Text>
        <div className="flex flex-col items-start justify-start gap-3 flex-1 h-full">
          {getRewardsByLevel(currentLevel.rank).map((reward) => (
            <RewardItem
              key={reward}
              reward={getRewardLabel(reward, currentLevel.rank)}
              unlocked={overMinimum}
            />
          ))}
        </div>

        {/* Navigation */}
        <nav className="flex items-center justify-between w-full">
          <IconButton
            symbol="arrow-left"
            onClick={prevLevel}
            disabled={currentLevelRank === 1}
            telemetryEvent="click_level_prev"
          />
          <IconButton
            symbol="arrow-right"
            onClick={nextLevel}
            disabled={false}
            telemetryEvent="click_level_next"
          />
        </nav>
      </div>
    </main>
  );
}

type RewardItemProps = {
  reward: string;
  unlocked: boolean;
};

function RewardItem(props: RewardItemProps) {
  const { reward, unlocked } = props;
  return (
    <div className="flex flex-row items-center justify-start gap-3">
      <Icon
        type={unlocked ? 'checkmark' : 'x'}
        className={unlocked ? 'text-orangered' : 'text-black/20'}
      />
      <Text className={unlocked ? 'text-black' : 'text-black/50'}>
        {reward}
      </Text>
    </div>
  );
}
