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
import { CONSUMABLES_CONFIG, getConsumableConfig } from '@shared/consumables';
import { context } from '@devvit/web/client';
import type { ConsumableId } from '@shared/consumables';

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
  const {
    data: inventory,
    isLoading: isInventoryLoading,
    refetch: refetchInventory,
  } = trpc.app.rewards.getInventory.useQuery(undefined, {
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
      setSelectedItemId(null);
      onClose();
    },
  });

  const hasAnyActiveEffect = (activeEffects?.length ?? 0) > 0;

  const [selectedItemId, setSelectedItemId] = useState<ConsumableId | null>(
    null
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

  const selectedQuantity = useMemo(() => {
    if (!selectedItemId) return 0;
    return inventory?.[selectedItemId] ?? 0;
  }, [selectedItemId, inventory]);

  const isUseDisabled =
    activateMutation.isPending || hasAnyActiveEffect || selectedQuantity <= 0;

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
              const base: number =
                getRewardValue(userLevel, 'extra_drawing_time') ?? 0;
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
        {/* Loading state */}
        {isInventoryLoading && (
          <Text className="text-secondary animate-pulse">Loading ...</Text>
        )}

        {/* Empty state */}
        {!isInventoryLoading && inventoryEntries.length === 0 && (
          <Text className="text-secondary">Your inventory is empty</Text>
        )}

        {/* Items list */}
        {!isInventoryLoading &&
          inventoryEntries.length > 0 &&
          inventoryEntries.map(([itemId, quantity]) => {
            const id = itemId as ConsumableId;
            return (
              <Item
                key={id}
                itemId={id}
                quantity={quantity}
                onView={() => {
                  setSelectedItemId(id);
                }}
              />
            );
          })}
      </div>

      <ItemModal
        itemId={selectedItemId}
        quantity={selectedQuantity}
        onClose={() => {
          setSelectedItemId(null);
        }}
        onUse={() => {
          if (selectedItemId) {
            activateMutation.mutate({ itemId: selectedItemId });
          }
        }}
        isUseDisabled={isUseDisabled}
      />
    </main>
  );
}

type ItemModalProps = {
  itemId: ConsumableId | null;
  quantity: number;
  onClose: () => void;
  onUse: () => void;
  isUseDisabled: boolean;
};

function ItemModal({
  itemId,
  quantity,
  onClose,
  onUse,
  isUseDisabled,
}: ItemModalProps) {
  // Get the item config
  const config = useMemo(
    () => (itemId ? getConsumableConfig(itemId) : null),
    [itemId]
  );

  if (!config || !itemId) return null;

  // Parse the label and description
  const label = config.label;
  const description = config.description;
  const descriptionLines = wrapTextByWidth(description, 128);

  return (
    <Modal isOpen={!!itemId} onClose={onClose}>
      <div className="flex flex-col items-center justify-center gap-6">
        {/* Illustration */}
        {renderConsumableIllustration(itemId, 48)}

        {/* Titling */}
        <div className="flex flex-col items-center justify-center gap-2">
          {/* Label */}
          <Text scale={2.5} className="text-primary">
            {label}
          </Text>

          {/* Description */}
          {descriptionLines.map((line, index) => (
            <Text key={`${line}-${index}`} className="text-tertiary">
              {line}
            </Text>
          ))}
        </div>

        {/* Quantity */}
        <Text className="text-muted">{`Quantity: ${quantity}`}</Text>

        {/* Actions */}
        <div className="flex flex-row items-center justify-center gap-6">
          <Button disabled={isUseDisabled} onClick={onUse} variant="white">
            Use
          </Button>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}

function renderConsumableIllustration(id: ConsumableId, size = 36) {
  switch (id) {
    case 'score_multiplier_2x':
      return <Multiplier variant="double" size={size} />;
    case 'score_multiplier_3x':
      return <Multiplier variant="triple" size={size} />;
    case 'draw_time_boost_30s':
      return <Clock size={size} />;
    default:
      return null;
  }
}

type ItemProps = {
  itemId: ConsumableId;
  quantity: number;
  onView: () => void;
};

function Item({ itemId, quantity, onView }: ItemProps) {
  return (
    <button
      type="button"
      className="flex h-20 w-20 items-center justify-center relative bg-white pixel-shadow cursor-pointer hover:shadow-pixel-sm active:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] transition-all"
      onClick={onView}
    >
      {renderConsumableIllustration(itemId)}
      <Text className="absolute bottom-2 right-2 text-muted">
        {String(quantity)}
      </Text>
    </button>
  );
}

function getRewardMinLevel(reward: string): number {
  const levelMap: Record<string, number> = {
    extra_drawing_time: 2,
    extra_word_time: 2,
    add_remove_words: 3,
    level_flair: 1,
  };
  return levelMap[reward] ?? 1;
}
