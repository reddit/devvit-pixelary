import { Confetti } from './Confetti';
import { PixelFont } from './PixelFont';
import { Button } from './Button';
import { PixelSymbol } from './PixelSymbol';
import { getRewardsByLevel, getRewardLabel } from '@shared/rewards';
import type { RewardType } from '@shared/rewards';

interface LevelUpModalProps {
  level: number;
  levelName: string;
  onClaim: () => void;
}

export function LevelUpModal({ level, levelName, onClaim }: LevelUpModalProps) {
  const rewards = getRewardsByLevel(level);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black-70 pointer-events-auto">
      {/* Continuous confetti background */}
      <div className="fixed inset-0">
        <Confetti count={Infinity} delay={10} speed={4} />
      </div>

      {/* Modal content */}
      <div className="relative bg-white flex flex-col gap-6 p-8 items-center justify-center max-w-md">
        {/* Header */}
        <div className="flex flex-col items-center gap-2">
          <PixelFont scale={4} className="text-primary">
            Level {level}!
          </PixelFont>
          <PixelFont scale={3} className="text-black-60">
            {levelName}
          </PixelFont>
        </div>

        {/* Perks section */}
        <div className="flex flex-col gap-2 w-full items-start">
          <PixelFont scale={2} className="text-black-60">
            Your perks:
          </PixelFont>
          <div className="flex flex-col gap-2 w-full">
            {rewards.map((reward: RewardType) => (
              <LevelUpRewardItem key={reward} reward={reward} level={level} />
            ))}
          </div>
        </div>

        {/* Claim button */}
        <Button onClick={onClaim} size="large">
          Claim
        </Button>

        {/* Border decorations */}
        <div className="absolute -top-1 left-1 right-1 h-1 bg-black" />
        <div className="absolute -bottom-1 left-1 right-1 h-1 bg-black" />
        <div className="absolute top-1 -left-1 bottom-1 w-1 bg-black" />
        <div className="absolute top-1 -right-1 bottom-1 w-1 bg-black" />
        <div className="absolute top-0 left-0 w-1 h-1 bg-black" />
        <div className="absolute top-0 right-0 w-1 h-1 bg-black" />
        <div className="absolute bottom-0 left-0 w-1 h-1 bg-black" />
        <div className="absolute bottom-0 right-0 w-1 h-1 bg-black" />
      </div>
    </div>
  );
}

interface LevelUpRewardItemProps {
  reward: RewardType;
  level: number;
}

function LevelUpRewardItem({ reward, level }: LevelUpRewardItemProps) {
  const label = getRewardLabel(reward, level);

  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-black-20">
      <PixelSymbol type="checkmark" className="text-success" scale={2} />
      <PixelFont scale={2}>{label}</PixelFont>
    </div>
  );
}
