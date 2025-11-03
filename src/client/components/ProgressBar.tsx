import { useEffect, useState } from 'react';
import { clamp } from '@src/shared/utils/numbers';

type ProgressBarProps = {
  percentage: number;
  width?: number;
  height?: number;
  className?: string;
};

export function ProgressBar({
  percentage,
  width = 256,
  height = 8,
  className = '',
}: ProgressBarProps) {
  const [displayPercentage, setDisplayPercentage] = useState(0);

  useEffect(() => {
    const clampedPercentage = clamp(percentage, 0, 100);
    setDisplayPercentage(clampedPercentage);
  }, [percentage]);

  return (
    <div
      className={`relative ${className}`}
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      {/* Background */}
      <div
        className="absolute inset-0 bg-black-20"
        style={{
          height: `${height}px`,
        }}
      />

      {/* Progress fill */}
      <div
        className="absolute left-0 top-0 bottom-0 transition-all duration-600 ease-in bg-orangered"
        style={{
          width: `${displayPercentage}%`,
        }}
      />
    </div>
  );
}
