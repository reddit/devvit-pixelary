import React, { useEffect, useRef } from 'react';
import { renderDrawingToCanvas } from '@shared/utils/drawing';
import { DrawingData } from '@shared/schema/drawing';

interface DrawingProps {
  data: DrawingData;
  size?: number;
  onClick?: () => void;
  className?: string;
  enableBreathing?: boolean;
  isPaused?: boolean;
}

export const Drawing = React.memo(function Drawing({
  data,
  size,
  onClick,
  className = '',
  enableBreathing = false,
  isPaused = false,
}: DrawingProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && data) {
      renderDrawingToCanvas(data, canvasRef.current);
    }
  }, [data]);

  // Animation classes
  const breathingClass =
    enableBreathing && !isPaused ? 'animate-pixel-breathe' : '';

  // If no size is provided, use auto-sizing
  if (size === undefined) {
    return (
      <div
        className={`w-full h-full flex items-center justify-center ${className}`}
        onClick={onClick}
      >
        <div className={`relative ${breathingClass}`}>
          <canvas
            ref={canvasRef}
            className="bg-white aspect-square w-full h-auto max-h-full"
            style={{
              imageRendering: 'pixelated',
            }}
          />
        </div>
      </div>
    );
  }

  // Fixed size rendering
  const clickableClasses = onClick
    ? 'cursor-pointer shadow-pixel hover:shadow-pixel-sm active:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] transition-all'
    : 'shadow-pixel';

  return (
    <div className={`relative ${className}`} onClick={onClick}>
      {/* Drawing */}
      <div
        className={`relative bg-white ${clickableClasses} ${breathingClass}`}
        style={{ width: size, height: size }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
    </div>
  );
});
