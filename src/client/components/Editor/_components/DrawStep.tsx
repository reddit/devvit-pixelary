import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@components/Button';
import { PixelSymbol } from '@components/PixelSymbol';
import { DRAWING_COLORS } from '@shared/constants';
import { PixelFont } from '@components/PixelFont';
import { DrawingData, DrawingUtils } from '@shared/schema/drawing';
import { getContrastColor } from '@shared/utils/color';
import type { HEX } from '@shared/types';
import { useTelemetry } from '@client/hooks/useTelemetry';
import { useSlate } from '@client/hooks/useSlate';

interface DrawStepProps {
  word: string;
  time: number;
  onComplete: (drawing: DrawingData) => void;
}

export function DrawStep(props: DrawStepProps) {
  const { word, time, onComplete } = props;

  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);

  const { track } = useTelemetry();
  const { trackSlateAction } = useSlate();

  // Track draw step view on mount - use ref to ensure it only runs once
  const hasTrackedView = useRef(false);
  useEffect(() => {
    if (!hasTrackedView.current) {
      void track('view_draw_step');
      // Also track as slate event for queue processing
      void trackSlateAction('start', word); // This maps to 'view_draw_step' in the slate processing
      hasTrackedView.current = true;
    }
  }, [track, trackSlateAction, word]);

  // Canvas state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentColor, setCurrentColor] = useState<HEX>('#000000');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingData, setDrawingData] = useState<DrawingData>(() =>
    DrawingUtils.createBlank()
  );

  const canvasInternalSize = 16;

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      const currentElapsed = Date.now() - startTime;
      setElapsedTime(currentElapsed);
      const remainingTime = time * 1000 - currentElapsed;
      if (remainingTime <= 0) {
        onComplete(drawingData);
      }
    }, 100);

    return () => clearInterval(timer);
  }, [startTime, time, onComplete]);

  const secondsLeft = Math.max(0, Math.round(time - elapsedTime / 1000));

  const handleDone = () => {
    void track('click_done_drawing');
    onComplete(drawingData);
  };

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set internal canvas resolution to 16x16
    canvas.width = canvasInternalSize;
    canvas.height = canvasInternalSize;

    // Disable image smoothing for pixelated rendering
    ctx.imageSmoothingEnabled = false;

    ctx.clearRect(0, 0, canvasInternalSize, canvasInternalSize);

    // Draw background
    ctx.fillStyle = drawingData.colors[drawingData.bg] || '#FFFFFF';
    ctx.fillRect(0, 0, canvasInternalSize, canvasInternalSize);

    // Draw pixels (optimized rendering)
    const pixelColors = DrawingUtils.getAllPixelColors(drawingData);
    const pixelSize = canvasInternalSize / drawingData.size;

    for (let pixelIndex = 0; pixelIndex < pixelColors.length; pixelIndex++) {
      const color = pixelColors[pixelIndex];

      if (color && color !== drawingData.colors[drawingData.bg]) {
        ctx.fillStyle = color;
        const pixelX = pixelIndex % drawingData.size;
        const pixelY = Math.floor(pixelIndex / drawingData.size);
        const x = pixelX * pixelSize;
        const y = pixelY * pixelSize;

        ctx.fillRect(x, y, pixelSize, pixelSize);
      }
    }

    // Draw checkerboard overlay
    for (let x = 0; x < drawingData.size; x++) {
      for (let y = 0; y < drawingData.size; y++) {
        const isEven = (x + y) % 2 === 0;
        ctx.fillStyle = isEven
          ? 'rgba(255, 255, 255, 0.05)'
          : 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
      }
    }
  }, [drawingData, canvasInternalSize]);

  const handlePixelClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Convert to normalized coordinates (0-1)
      const normalizedX = x / rect.width;
      const normalizedY = y / rect.height;

      const pixelX = Math.floor(normalizedX * drawingData.size);
      const pixelY = Math.floor(normalizedY * drawingData.size);

      if (
        pixelX >= 0 &&
        pixelX < drawingData.size &&
        pixelY >= 0 &&
        pixelY < drawingData.size
      ) {
        const index = pixelY * drawingData.size + pixelX;
        setDrawingData((prev) =>
          DrawingUtils.setPixel(prev, index, currentColor)
        );
      }
    },
    [currentColor]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      setIsDrawing(true);
      handlePixelClick(e);
    },
    [handlePixelClick]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      handlePixelClick(e);
    },
    [isDrawing, handlePixelClick]
  );

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      setIsDrawing(true);
      const touch = e.touches[0];
      if (touch) {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        // Convert to normalized coordinates (0-1)
        const normalizedX = x / rect.width;
        const normalizedY = y / rect.height;

        const pixelX = Math.floor(normalizedX * drawingData.size);
        const pixelY = Math.floor(normalizedY * drawingData.size);

        if (
          pixelX >= 0 &&
          pixelX < drawingData.size &&
          pixelY >= 0 &&
          pixelY < drawingData.size
        ) {
          const index = pixelY * drawingData.size + pixelX;
          setDrawingData((prev) =>
            DrawingUtils.setPixel(prev, index, currentColor)
          );
        }
      }
    },
    [currentColor]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      e.preventDefault();
      const touch = e.touches[0];
      if (touch) {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        // Convert to normalized coordinates (0-1)
        const normalizedX = x / rect.width;
        const normalizedY = y / rect.height;

        const pixelX = Math.floor(normalizedX * drawingData.size);
        const pixelY = Math.floor(normalizedY * drawingData.size);

        if (
          pixelX >= 0 &&
          pixelX < drawingData.size &&
          pixelY >= 0 &&
          pixelY < drawingData.size
        ) {
          const index = pixelY * drawingData.size + pixelX;
          setDrawingData((prev) =>
            DrawingUtils.setPixel(prev, index, currentColor)
          );
        }
      }
    },
    [isDrawing, currentColor]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      setIsDrawing(false);
    },
    []
  );

  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center p-6 gap-6">
      {/* Header */}
      <header className="flex flex-row items-center justify-center h-min w-full gap-3">
        <div className="flex flex-col items-start justify-center gap-1 w-full h-full flex-1">
          <PixelFont scale={2.5}>{word}</PixelFont>
          <div className="flex flex-row items-center gap-2 text-[var(--color-brand-secondary)]">
            <PixelSymbol type="clock" />
            <PixelFont scale={2}>{`${secondsLeft}s left`}</PixelFont>
          </div>
        </div>

        <Button
          onClick={handleDone}
          size="medium"
          telemetryEvent="click_done_drawing"
        >
          DONE
        </Button>
      </header>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center relative">
        <canvas
          ref={canvasRef}
          className="cursor-crosshair w-full h-full max-w-full max-h-full aspect-square pixel-shadow"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
        {DrawingUtils.isEmpty(drawingData) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <PixelFont scale={2} className="text-[var(--color-brand-tertiary)]">
              Tap to draw
            </PixelFont>
          </div>
        )}
      </div>

      {/* Color Palette */}
      <div className="flex flex-row gap-2 items-center justify-center">
        {DRAWING_COLORS.map((color) => (
          <ColorSwatch
            key={color}
            onSelect={() => {
              void track('click_color_swatch');
              setCurrentColor(color);
            }}
            color={color}
            isSelected={currentColor === color}
          />
        ))}
      </div>
    </main>
  );
}

interface ColorSwatchProps {
  color: HEX;
  isSelected: boolean;
  onSelect: (color: HEX) => void;
}

function ColorSwatch(props: ColorSwatchProps) {
  const { color, isSelected, onSelect } = props;

  return (
    <button
      onClick={() => onSelect(color)}
      className="w-8 h-8 border-4 border-black cursor-pointer transition-all flex items-center justify-center hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] active:shadow-none"
      style={{ backgroundColor: color }}
    >
      <PixelSymbol
        type="checkmark"
        scale={2}
        color={getContrastColor(color)}
        className={`transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}
      />
    </button>
  );
}
