export interface ProgressBarProps {
  percentage: number;
  width?: number;
  height?: number;
  className?: string;
}

export function ProgressBar({
  percentage,
  width = 256,
  height = 8,
  className = '',
}: ProgressBarProps) {
  const clampedPercentage = Math.max(0, Math.min(100, percentage));

  return (
    <div
      className={`relative ${className}`}
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      {/* Background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          height: `${height}px`,
        }}
      />

      {/* Progress fill */}
      <div
        className="absolute inset-y-0 left-0 transition-all duration-300 min-w-1"
        style={{
          backgroundColor: '#FF4500',
          width: `${clampedPercentage}%`,
          height: `${height}px`,
        }}
      />
    </div>
  );
}
