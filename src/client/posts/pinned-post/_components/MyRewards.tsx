import { PixelFont } from '@components/PixelFont';
import { PixelSymbol } from '@components/PixelSymbol';
import { IconButton } from '@components/IconButton';
import { useTelemetry } from '@client/hooks/useTelemetry';
import { useEffect } from 'react';
import { trpc } from '@client/trpc/client';
import {
  getAllRewards,
  hasReward,
  getRewardLabel,
  getRewardValue,
} from '@shared/rewards';

interface MyRewardsProps {
  onClose: () => void;
}

// Helper function to get minimum level for a reward
function getRewardMinLevel(reward: string): number {
  const levelMap: Record<string, number> = {
    extra_drawing_time: 2,
    extra_word_time: 2,
    add_remove_words: 3,
    extended_colors: 4,
    level_flair: 1,
  };
  return levelMap[reward] ?? 1;
}

export function MyRewards({ onClose }: MyRewardsProps) {
  // Telemetry
  const { track } = useTelemetry();
  useEffect(() => {
    void track('view_my_rewards');
  }, []);

  // Get user profile data
  const { data: userProfile } = trpc.app.user.getProfile.useQuery();

  const userLevel = userProfile?.level ?? 1;
  const allRewards = getAllRewards();

  // Filter to only show unlocked rewards and sort by level requirement
  const unlockedRewards = allRewards
    .filter((reward) => hasReward(userLevel, reward))
    .sort((a, b) => {
      const aLevel = getRewardMinLevel(a);
      const bLevel = getRewardMinLevel(b);
      return aLevel - bLevel;
    });

  return (
    <main className="absolute inset-0 flex flex-col p-4 gap-4">
      {/* Header */}
      <header className="shrink-0 w-full flex flex-row items-center justify-between">
        <PixelFont scale={2.5}>My Rewards</PixelFont>
        <IconButton onClick={onClose} symbol="X" />
      </header>

      {/* Stack of Reward Cards */}
      <div className="flex-1 w-full space-y-3">
        {unlockedRewards.map((reward) => {
          const minLevel = getRewardMinLevel(reward);
          const currentValue = getRewardValue(userLevel, reward);

          // Custom labels for progressive rewards
          let displayLabel: string;
          let levelInfo: string;

          if (reward === 'extra_drawing_time') {
            displayLabel = 'Drawing time';
            levelInfo = `+${currentValue}s at level ${userLevel}`;
          } else if (reward === 'extra_word_time') {
            displayLabel = 'Selection time';
            levelInfo = `+${currentValue}s at level ${userLevel}`;
          } else if (reward === 'level_flair') {
            displayLabel = 'User flair';
            levelInfo = `Level ${userLevel}`;
          } else {
            displayLabel = getRewardLabel(reward, userLevel);
            levelInfo = `Level ${minLevel}`;
          }

          return (
            <div
              key={reward}
              className="flex items-center gap-4 p-4 bg-white pixel-shadow"
            >
              <PixelSymbol
                type="checkmark"
                className="text-success"
                scale={3}
              />
              <div className="flex flex-col gap-2">
                <PixelFont scale={2}>{displayLabel}</PixelFont>
                <PixelFont scale={2} className="text-black-40">
                  {levelInfo}
                </PixelFont>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
