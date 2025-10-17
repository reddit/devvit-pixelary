import { useEffect, useState } from 'react';
import { ProgressBar } from './ProgressBar';
import { PixelFont } from './PixelFont';
import { getLevelByScore } from '../../shared/utils/progression';

export interface LevelProgressAttachmentProps {
  newScore: number;
  earnedPoints: number;
}

export function LevelProgressAttachment({
  newScore,
  earnedPoints,
}: LevelProgressAttachmentProps) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);

  // Get current level info
  const currentLevel = getLevelByScore(newScore);

  // Calculate progress within current level
  const levelProgress = newScore - currentLevel.min;
  const levelMax = currentLevel.max - currentLevel.min;
  const progressPercentage = Math.min(
    100,
    Math.max(0, (levelProgress / levelMax) * 100)
  );

  // Calculate points needed for next level
  const pointsToNextLevel = currentLevel.max - newScore;
  const isMaxLevel = currentLevel.max === Infinity || pointsToNextLevel <= 0;

  // Animate progress bar from 0 to final percentage
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercentage(progressPercentage);
    }, 100); // Small delay for smooth entrance

    return () => clearTimeout(timer);
  }, [progressPercentage]);

  return (
    <div className="flex flex-col gap-2">
      {/* Level name */}
      <div className="flex items-center justify-between">
        <PixelFont scale={1.5} className="text-black">
          {String(currentLevel.name)}
        </PixelFont>
        {!isMaxLevel && (
          <PixelFont scale={1} className="text-gray-600">
            {String(pointsToNextLevel)} to next level
          </PixelFont>
        )}
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <ProgressBar
          percentage={animatedPercentage}
          width={200}
          height={6}
          className="flex-1"
        />
        <PixelFont scale={1} className="text-gray-600 min-w-fit">
          {String(Math.round(animatedPercentage))}%
        </PixelFont>
      </div>

      {/* Points earned indicator */}
      <PixelFont scale={1} className="text-gray-500 text-center">
        +{String(earnedPoints)} points earned
      </PixelFont>
    </div>
  );
}
