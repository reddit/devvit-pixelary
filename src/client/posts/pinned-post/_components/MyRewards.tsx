import { Text, Icon } from '@components/PixelFont';
import { IconButton } from '@components/IconButton';
import { Button } from '@components/Button';
import { Modal } from '@components/Modal';
import { Multiplier, Clock } from '@components/illustrations';
import { useTelemetry } from '@client/hooks/useTelemetry';
import { useEffect, useMemo, useState } from 'react';
import { trpc } from '@client/trpc/client';
import { wrapTextByWidth } from '@client/components/PixelFont';
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

/**
 * Props for the MyRewards component.
 * @param onClose - The function to call when the modal is closed.
 */

type MyRewardsProps = {
  onClose: () => void;
};

/**
 * My Rewards component.
 * @param onClose - The function to call when the modal is closed.
 * @returns The rendered My Rewards component.
 */

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
    () => wrapTextByWidth(selectedDescription, 128),
    [selectedDescription]
  );

  const activeExtraDrawingSeconds = useMemo(() => {
    const list = activeEffects ?? [];
    let total = 0;
    for (const e of list) {
      const effect = e.effect;
      if (effect.kind === 'extra_drawing_time') {
        total += effect.extraSeconds;
      }
    }
    return total;
  }, [activeEffects]);

  const inventoryEntries = useMemo(() => {
    const entries = Object.entries(inventory ?? {});
    return entries
      .filter(([, qty]) => typeof qty === 'number' && qty > 0)
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
        <Text scale={2.5}>My Rewards</Text>
        <IconButton onClick={onClose} symbol="X" />
      </header>

      {/* Rewards - single card listing unlocked items */}
      <div className="p-4 bg-white pixel-shadow flex flex-col items-start justify-start gap-4">
        {unlockedRewards.length === 0 ? (
          <Text className="text-muted">No rewards unlocked yet</Text>
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
                <Icon type="checkmark" className="text-success" />
                <Text>{displayLabel}</Text>
              </div>
            );
          })
        )}
      </div>

      <div className="h-8 w-full flex flex-row items-center justify-start">
        <Text scale={2.5}>Inventory</Text>
      </div>

      {/* Consumables Inventory */}
      <div className="flex flex-row items-start justify-start gap-4">
        {inventoryEntries.length === 0 ? (
          <Text className="text-muted">
            You don't have any consumables yet.
          </Text>
        ) : (
          inventoryEntries.map(([itemId, quantity]) => {
            const id = itemId as ConsumableId;
            const disabled =
              activateMutation.isPending || hasAnyActiveEffect || quantity <= 0;
            return (
              <ConsumableItem
                key={id}
                itemId={id}
                quantity={quantity}
                onView={() => {
                  setSelectedItemId(id);
                }}
                onUse={() => {
                  activateMutation.mutate({ itemId: id });
                }}
                disabled={disabled}
              />
            );
          })
        )}
      </div>

      <Modal
        isOpen={!!selectedItemId}
        onClose={() => {
          setSelectedItemId(null);
        }}
      >
        <div className="flex flex-col items-center justify-center gap-6">
          {selectedItemId && renderConsumableIllustration(selectedItemId, 48)}

          <div className="flex flex-col items-center justify-center gap-2">
            <Text className="text-primary">{selectedConfig?.label ?? ''}</Text>
            {descriptionLines.map((line, i) => (
              <Text key={i} className="text-tertiary">
                {line}
              </Text>
            ))}
          </div>

          <Button
            onClick={() => {
              setSelectedItemId(null);
            }}
          >
            Okay
          </Button>
        </div>
      </Modal>
    </main>
  );
}

/**
 * Render the consumable illustration for a given item ID.
 * @param id - The item ID.
 * @param size - The size of the illustration.
 * @returns The rendered illustration.
 */

function renderConsumableIllustration(id: ConsumableId, size = 36) {
  switch (id) {
    case 'score_multiplier_2x_4h':
      return <Multiplier variant="double" size={size} />;
    case 'score_multiplier_3x_30m':
      return <Multiplier variant="triple" size={size} />;
    case 'draw_time_boost_30s_2h':
      return <Clock size={size} />;
    default:
      return null;
  }
}

/**
 * Props for the ConsumableItem component.
 * @param itemId - The item ID.
 * @param quantity - The quantity of the item.
 * @param disabled - Whether the item is disabled.
 * @param onUse - The function to call when the item is used.
 * @param onView - The function to call when the item is viewed.
 */

type ConsumableItemProps = {
  itemId: ConsumableId;
  quantity: number;
  disabled: boolean;
  onUse: () => void;
  onView: () => void;
};

/**
 * Render a consumable item.
 * @param itemId - The item ID.
 * @param quantity - The quantity of the item.
 * @param disabled - Whether the item is disabled.
 * @param onUse - The function to call when the item is used.
 * @param onView - The function to call when the item is viewed.
 * @returns The rendered consumable item.
 */

function ConsumableItem({
  itemId,
  quantity,
  onView,
  onUse,
  disabled,
}: ConsumableItemProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="flex h-24 w-24 items-center justify-center relative bg-white pixel-shadow cursor-pointer"
        onClick={() => {
          onView();
        }}
      >
        {renderConsumableIllustration(itemId)}
        <Text scale={2} className="text-muted absolute bottom-2 left-2">
          {String(quantity)}
        </Text>
      </div>

      <Button
        variant="primary"
        size="small"
        className="w-full"
        disabled={disabled}
        onClick={() => {
          onUse();
        }}
      >
        Use
      </Button>
    </div>
  );
}

/**
 * Get the minimum level for a reward.
 * @param reward - The reward.
 * @returns The minimum level.
 */

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
