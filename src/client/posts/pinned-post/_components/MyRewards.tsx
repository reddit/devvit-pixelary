import { PixelFont } from '@components/PixelFont';
import { PixelSymbol } from '@components/PixelSymbol';
import { IconButton } from '@components/IconButton';
import { Button } from '@components/Button';
import { Modal } from '@components/Modal';
import { Multiplier, Clock } from '@components/illustrations';
import { useTelemetry } from '@client/hooks/useTelemetry';
import { useEffect, useMemo, useState } from 'react';
import { trpc } from '@client/trpc/client';
import { chunkByPixelWidth } from '@client/utils/pixelText';
import { useToastHelpers } from '@components/ToastManager';
import {
  getAllRewards,
  hasReward,
  getRewardLabel,
  getRewardValue,
} from '@shared/rewards';
import {
  CONSUMABLES_CONFIG,
  getConsumableConfig,
  getEffectDescription,
} from '@shared/consumables';
import { context } from '@devvit/web/client';
import type { ConsumableEffect, ConsumableId } from '@shared/consumables';

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
  const { success } = useToastHelpers();
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
      success('Used!');
      void refetchInventory();
      void refetchEffects();
    },
  });

  const hasAnyActiveEffect = (activeEffects?.length ?? 0) > 0;

  const [selectedItemId, setSelectedItemId] = useState<ConsumableId | null>(
    null
  );
  const selectedConfig = useMemo(
    () => (selectedItemId ? getConsumableConfig(selectedItemId) : null),
    [selectedItemId]
  );
  const selectedDescription = useMemo(
    () => (selectedConfig ? getEffectDescription(selectedConfig.effect) : ''),
    [selectedConfig]
  );
  const descriptionLines = useMemo(
    () => chunkByPixelWidth(selectedDescription, 128),
    [selectedDescription]
  );

  const activeExtraDrawingSeconds = useMemo(() => {
    const list = activeEffects ?? [];
    let total = 0;
    for (const e of list) {
      const effect = e.effect as ConsumableEffect;
      if (effect && effect.kind === 'extra_drawing_time') {
        total += effect.extraSeconds;
      }
    }
    return total;
  }, [activeEffects]);

  function renderConsumableIllustration(id: ConsumableId, size = 36) {
    if (id === 'score_multiplier_2x_4h') {
      return <Multiplier variant="double" size={size} />;
    }
    if (id === 'score_multiplier_3x_30m') {
      return <Multiplier variant="triple" size={size} />;
    }
    if (id === 'draw_time_boost_30s_2h') {
      return <Clock size={size} />;
    }
    return null;
  }

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

  return (
    <main className="absolute inset-0 flex flex-col p-4 gap-4 overflow-visible">
      {/* Header */}
      <header className="shrink-0 w-full flex flex-row items-center justify-between">
        <PixelFont scale={2.5}>My Rewards</PixelFont>
        <IconButton onClick={onClose} symbol="X" />
      </header>

      {/* Rewards - single card listing unlocked items */}
      <div className="p-4 bg-white pixel-shadow flex flex-col items-start justify-start gap-4">
        {unlockedRewards.length === 0 ? (
          <PixelFont className="text-muted">No rewards unlocked yet</PixelFont>
        ) : (
          unlockedRewards.map((reward) => {
            let displayLabel: string;

            if (reward === 'extra_drawing_time') {
              const base = getRewardValue(userLevel, 'extra_drawing_time') ?? 0;
              displayLabel = `+${base + activeExtraDrawingSeconds}s drawing time`;
            } else if (reward === 'extra_word_time') {
              const base = getRewardValue(userLevel, 'extra_word_time') ?? 0;
              displayLabel = `+${base}s selection time`;
            } else if (reward === 'level_flair') {
              displayLabel = `Level ${userLevel} flair`;
            } else {
              displayLabel = getRewardLabel(reward, userLevel);
            }

            return (
              <div key={reward} className="flex items-center gap-4">
                <PixelSymbol type="checkmark" className="text-success" />
                <PixelFont>{displayLabel}</PixelFont>
              </div>
            );
          })
        )}
      </div>

      <div className="h-8 w-full flex flex-row items-center justify-start">
        <PixelFont scale={2.5}>Inventory</PixelFont>
      </div>

      {/* Consumables Inventory */}
      <div className="flex flex-row items-start justify-start gap-4">
        {inventoryEntries.length === 0 ? (
          <PixelFont className="text-muted">
            You don't have any consumables yet.
          </PixelFont>
        ) : (
          inventoryEntries.map(([itemId, qty]) => {
            return (
              <div key={itemId} className="flex flex-col items-center gap-2">
                <div
                  className="flex h-24 w-24 items-center justify-center relative bg-white pixel-shadow cursor-pointer"
                  onClick={() => setSelectedItemId(itemId as ConsumableId)}
                >
                  {renderConsumableIllustration(itemId as ConsumableId)}
                  <PixelFont
                    scale={2}
                    className="text-muted absolute bottom-2 left-2"
                  >
                    {String(qty)}
                  </PixelFont>
                </div>

                <Button
                  variant="primary"
                  size="small"
                  className="w-full"
                  disabled={
                    activateMutation.isPending ||
                    hasAnyActiveEffect ||
                    (qty as number) <= 0
                  }
                  onClick={() =>
                    activateMutation.mutate({ itemId: itemId as never })
                  }
                >
                  Use
                </Button>
              </div>
            );
          })
        )}
      </div>

      <Modal isOpen={!!selectedItemId} onClose={() => setSelectedItemId(null)}>
        <div className="flex flex-col items-center justify-center gap-6">
          {selectedItemId && renderConsumableIllustration(selectedItemId, 48)}

          <div className="flex flex-col items-center justify-center gap-2">
            <PixelFont className="text-primary">
              {selectedConfig?.label ?? ''}
            </PixelFont>
            {descriptionLines.map((line, i) => (
              <PixelFont key={i} className="text-tertiary">
                {line}
              </PixelFont>
            ))}
          </div>

          <Button onClick={() => setSelectedItemId(null)}>Okay</Button>
        </div>
      </Modal>
    </main>
  );
}
