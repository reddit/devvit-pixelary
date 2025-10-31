import { PixelFont } from '@components/PixelFont';
import { PixelSymbol } from '@components/PixelSymbol';
import { IconButton } from '@components/IconButton';
import { Button } from '@components/Button';
import { useTelemetry } from '@client/hooks/useTelemetry';
import { useEffect, useMemo } from 'react';
import { trpc } from '@client/trpc/client';
import {
  getAllRewards,
  hasReward,
  getRewardLabel,
  getRewardValue,
} from '@shared/rewards';
import { CONSUMABLES_CONFIG } from '@shared/consumables';
import { context } from '@devvit/web/client';

interface MyRewardsProps {
  onClose: () => void;
}

// Helper function to get minimum level for a reward
function getRewardMinLevel(reward: string): number {
  const levelMap: Record<string, number> = {
    extra_drawing_time: 2,
    extra_word_time: 2,
    add_remove_words: 3,
    extended_colors_tier_1: 2,
    extended_colors_tier_2: 3,
    extended_colors_tier_3: 4,
    extended_colors_tier_4: 5,
    level_flair: 1,
  };
  return levelMap[reward] ?? 1;
}

export function MyRewards({ onClose }: MyRewardsProps) {
  // Telemetry
  const { track } = useTelemetry();
  useEffect(() => {
    void track('view_my_rewards');
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Inventory & Active Effects
  const { data: inventory, refetch: refetchInventory } =
    trpc.app.rewards.getInventory.useQuery(undefined, {
      enabled: !!context.userId,
      staleTime: 5000,
    });
  const { data: activeEffects, refetch: refetchEffects } =
    trpc.app.rewards.getActiveEffects.useQuery(undefined, {
      enabled: !!context.userId,
      staleTime: 5000,
    });
  const activateMutation = trpc.app.rewards.activateConsumable.useMutation({
    onSuccess: () => {
      void refetchInventory();
      void refetchEffects();
    },
  });

  const inventoryEntries = useMemo(() => {
    const entries = Object.entries(inventory ?? {});
    return entries
      .filter(([, qty]) => (qty as number) > 0)
      .sort((a, b) =>
        CONSUMABLES_CONFIG[
          a[0] as keyof typeof CONSUMABLES_CONFIG
        ].label.localeCompare(
          CONSUMABLES_CONFIG[b[0] as keyof typeof CONSUMABLES_CONFIG].label
        )
      );
  }, [inventory]);

  function formatTimeRemaining(expiresAt: number): string {
    const ms = Math.max(0, expiresAt - Date.now());
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  }

  return (
    <main className="absolute inset-0 flex flex-col p-4 gap-4">
      {/* Header */}
      <header className="shrink-0 w-full flex flex-row items-center justify-between">
        <PixelFont scale={2.5}>My Rewards</PixelFont>
        <IconButton onClick={onClose} symbol="X" />
      </header>

      {/* Stack of Reward Cards */}
      <div className="flex-1 w-full space-y-3 overflow-y-auto">
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

        {/* Consumables Inventory */}
        <div className="mt-4">
          <PixelFont scale={2.5}>Consumables</PixelFont>
          {inventoryEntries.length === 0 ? (
            <div className="mt-2 p-4 bg-white pixel-shadow">
              <PixelFont scale={2} className="text-black-40">
                You don't have any consumables yet.
              </PixelFont>
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              {inventoryEntries.map(([itemId, qty]) => {
                const cfg =
                  CONSUMABLES_CONFIG[itemId as keyof typeof CONSUMABLES_CONFIG];
                return (
                  <div
                    key={itemId}
                    className="flex items-center justify-between gap-4 p-4 bg-white pixel-shadow"
                  >
                    <div className="flex flex-col gap-1">
                      <PixelFont scale={2}>{cfg.label}</PixelFont>
                      <PixelFont scale={2} className="text-black-40">
                        {String(qty)} available
                      </PixelFont>
                    </div>
                    <Button
                      variant="secondary"
                      size="small"
                      disabled={
                        activateMutation.isPending || (qty as number) <= 0
                      }
                      onClick={() =>
                        activateMutation.mutate({ itemId: itemId as never })
                      }
                    >
                      Activate
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Effects */}
        <div className="mt-4">
          <PixelFont scale={2.5}>Active effects</PixelFont>
          {activeEffects && activeEffects.length > 0 ? (
            <div className="mt-2 space-y-2">
              {activeEffects.map((e) => {
                const cfg =
                  CONSUMABLES_CONFIG[
                    e.itemId as keyof typeof CONSUMABLES_CONFIG
                  ];
                return (
                  <div
                    key={e.activationId}
                    className="flex items-center justify-between gap-4 p-4 bg-white pixel-shadow"
                  >
                    <div className="flex flex-col gap-1">
                      <PixelFont scale={2}>{cfg.label}</PixelFont>
                      <PixelFont scale={2} className="text-black-40">
                        {formatTimeRemaining(e.expiresAt)}
                      </PixelFont>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-2 p-4 bg-white pixel-shadow">
              <PixelFont scale={2} className="text-black-40">
                No active effects
              </PixelFont>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
