import { Confetti } from './Confetti';
import { PixelFont } from './PixelFont';
import { Button } from './Button';
import { PixelSymbol } from './PixelSymbol';
import { ModalScrim } from './ModalScrim';
import { ModalBody } from './ModalBody';
import { getRewardsByLevel, getRewardLabel } from '@shared/rewards';
import type { RewardType } from '@shared/rewards';
import { createPortal } from 'react-dom';

interface LevelUpModalProps {
  level: number;
  onClaim: () => void;
}

export function LevelUpModal({ level, onClaim }: LevelUpModalProps) {
  const rewards = getRewardsByLevel(level);
  const rewardCount = rewards.length;

  const content = (
    <ModalScrim persistent>
      {/* Continuous confetti background */}
      <div className="fixed inset-0">
        <Confetti count={Infinity} delay={10} speed={4} />
      </div>

      <ModalBody>
        {/* Title */}
        <PixelFont scale={4} className="text-primary">
          {`Level ${level}!`}
        </PixelFont>

        {/* Description */}
        <div className="flex flex-col items-center gap-3">
          <PixelFont scale={2} className="text-success">
            You leveled up,
          </PixelFont>
          <PixelFont scale={2} className="text-success">
            {`earning reward${rewardCount === 1 ? '' : 's'}!`}
          </PixelFont>
        </div>

        {/* Rewards */}
        <div className="flex flex-col gap-3 w-full">
          {rewards.map((reward: RewardType) => (
            <LevelUpRewardItem key={reward} reward={reward} level={level} />
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

interface LevelUpRewardItemProps {
  reward: RewardType;
  level: number;
}

function LevelUpRewardItem({ reward, level }: LevelUpRewardItemProps) {
  const label = getRewardLabel(reward, level);

  return (
    <div className="flex items-center gap-3">
      <PixelSymbol type="checkmark" className="text-success" scale={2} />
      <PixelFont scale={2}>{label}</PixelFont>
    </div>
  );
}
