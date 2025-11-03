import { Confetti } from './Confetti';
import { Text } from './PixelFont';
import { Button } from './Button';
import { Icon } from './PixelFont';
import { ModalScrim } from './ModalScrim';
import { ModalBody } from './ModalBody';
import { getRewardsByLevel, getRewardLabel } from '@shared/rewards';
import type { RewardType } from '@shared/rewards';
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
  const rewardCount = rewards.length;

  const content = (
    <ModalScrim persistent>
      {/* Continuous confetti */}
      <Confetti count={Infinity} delay={10} speed={4} />

      <ModalBody>
        {/* Title */}
        <Text scale={4} className="text-primary">
          {`Level ${level}!`}
        </Text>

        {/* Description */}
        <div className="flex flex-col items-center gap-3">
          <Text scale={2} className="text-success">
            You leveled up,
          </Text>
          <Text scale={2} className="text-success">
            {`earning reward${rewardCount === 1 ? '' : 's'}!`}
          </Text>
        </div>

        {/* Rewards */}
        <div className="flex flex-col gap-3 w-full">
          {rewards.map((reward: RewardType) => (
            <RewardItem key={reward} reward={reward} level={level} />
          ))}
        </div>

        {/* Claim button */}
        <Button onClick={onClaim} size="large">
          {`CLAIM REWARD${rewardCount === 1 ? '' : 'S'}`}
        </Button>
      </ModalBody>
    </ModalScrim>
  );

  const portalRoot = document.getElementById('portal-root');
  if (!portalRoot) return null;

  return createPortal(content, portalRoot);
}

type RewardItemProps = {
  reward: RewardType;
  level: number;
};

/**
 * Reward item component for the level up modal
 */

function RewardItem(props: RewardItemProps) {
  const { reward, level } = props;
  const label = getRewardLabel(reward, level);
  return (
    <div className="flex items-center gap-3">
      <Icon type="checkmark" className="text-success" scale={2} />
      <Text scale={2}>{label}</Text>
    </div>
  );
}
