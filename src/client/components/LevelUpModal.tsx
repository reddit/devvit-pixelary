import { Confetti } from './Confetti';
import { Text } from './PixelFont';
import { Button } from './Button';
import { Icon } from './PixelFont';
import { ModalScrim } from './ModalScrim';
import { ModalBody } from './ModalBody';
import { getRewardsByLevel, getRewardLabel } from '@shared/rewards';
import { getConsumablesGrantedOnLevelClaim } from '@shared/consumables';
import type { ConsumableId } from '@shared/consumables';
import { Multiplier, Clock } from '@components/illustrations';
import { createPortal } from 'react-dom';

type LevelUpModalProps = {
  level: number;
  onClaim: () => void;
};

/**
 * Level up modal component
 */

export function LevelUpModal(props: LevelUpModalProps) {
  const { level, onClaim } = props;
  const rewards = getRewardsByLevel(level);
  const claimConsumables = getConsumablesGrantedOnLevelClaim(level);

  // Aggregate rewards for display:
  // - Remove level user flair from the dialog
  // - Combine all extended color tiers into a single "+N colors" line
  const EXTENDED_COLOR_PREFIX = 'extended_colors_tier_';
  const colorTierRewards = rewards.filter((r) =>
    r.startsWith(EXTENDED_COLOR_PREFIX)
  );
  const otherRewards = rewards.filter(
    (r) => r !== 'level_flair' && !r.startsWith(EXTENDED_COLOR_PREFIX)
  );

  const displayRewardItems: Array<{ key: string; label: string }> = [
    ...otherRewards.map((r) => ({ key: r, label: getRewardLabel(r, level) })),
  ];

  if (colorTierRewards.length > 0) {
    const COLORS_PER_TIER = 14;
    const totalColors = colorTierRewards.length * COLORS_PER_TIER;
    displayRewardItems.push({
      key: 'extended_colors_aggregate',
      label: `+${totalColors} colors`,
    });
  }

  const content = (
    <ModalScrim persistent>
      {/* Continuous confetti */}
      <Confetti count={Infinity} delay={10} speed={4} />

      <ModalBody>
        {/* Titling */}
        <div className="flex flex-col gap-2 w-full items-center justify-center">
          <Text className="text-success">You reached</Text>
          <Text scale={4} className="text-primary">
            {`Level ${level}!`}
          </Text>
        </div>

        {/* Rewards */}
        <div className="flex flex-col gap-3 w-full">
          <Text className="text-success w-full">Rewards</Text>
          <div className="flex flex-col gap-3 w-full">
            {displayRewardItems.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <Icon type="checkmark" className="text-success" />
                <Text>{label}</Text>
              </div>
            ))}
          </div>
        </div>

        {/* Consumables */}
        {claimConsumables.length > 0 && (
          <div className="flex flex-col gap-3 w-full">
            <Text className="text-success w-full">Consumables</Text>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {claimConsumables.map(({ itemId, quantity }) => (
                <div
                  key={itemId}
                  className="relative grid place-items-center w-16 h-16 bg-success/30"
                >
                  {renderConsumableIllustration(itemId, 12 * 3)}
                  <div className="absolute bottom-0 right-0 bg-success/80 py-1 px-2">
                    <Text className="text-white">{String(quantity)}</Text>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Claim button */}
        <Button
          onClick={onClaim}
          size="large"
          variant="success"
          className="press-hint"
        >
          Claim!
        </Button>
      </ModalBody>
    </ModalScrim>
  );

  const portalRoot = document.getElementById('portal-root');
  if (!portalRoot) return null;

  return createPortal(content, portalRoot);
}

function renderConsumableIllustration(id: ConsumableId, size = 24) {
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
