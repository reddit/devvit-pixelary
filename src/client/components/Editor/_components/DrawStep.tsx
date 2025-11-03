import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@components/Button';
import { Icon } from '@components/PixelFont';
import { DRAWING_COLORS, getAvailableExtendedColors } from '@client/constants';
import { DRAWING_DURATION } from '@shared/constants';
import { Text } from '@components/PixelFont';
import { DrawingUtils, type DrawingData } from '@shared/schema/drawing';
import { getContrastColor } from '@shared/utils/color';
import type { HEX } from '@shared/types';
import { useTelemetry } from '@client/hooks/useTelemetry';
import type { SlateAction } from '@shared/types';
import { Modal } from '@components/Modal';

type DrawStepProps = {
  word: string;
  time: number;
  onComplete: (drawing: DrawingData) => void;
  slateId: string | null;
  trackSlateAction: (
    action: SlateAction,
    word?: string,
    metadata?: Record<string, string | number>
  ) => Promise<void>;
  userLevel: number;
};

export function DrawStep(props: DrawStepProps) {
  const { word, time, onComplete, slateId, trackSlateAction, userLevel } =
    props;

  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);

  const { track } = useTelemetry();

  // Track draw step view on mount - use ref to ensure it only runs once
  const hasTrackedView = useRef(false);
  useEffect(() => {
    if (!hasTrackedView.current) {
      void track('view_draw_step');
      void track('drawing_start');
      hasTrackedView.current = true;
    }
  }, [track, trackSlateAction, word, slateId]);

  // Canvas state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentColor, setCurrentColor] = useState<HEX>('#000000');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingData, setDrawingData] = useState<DrawingData>(() =>
    DrawingUtils.createBlank()
  );
  const hasTrackedFirstPixel = useRef(false);
  const drawingDataRef = useRef<DrawingData>(DrawingUtils.createBlank());

  // Color picker modal state
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  const canvasInternalSize = 256;

  // Keep drawingDataRef in sync with drawingData state
  useEffect(() => {
    drawingDataRef.current = drawingData;
  }, [drawingData]);

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      const currentElapsed = Date.now() - startTime;
      setElapsedTime(currentElapsed);
      const remainingTime = time * 1000 - currentElapsed;
      if (remainingTime <= 0) {
        void track('drawing_done_auto');
        onComplete(drawingDataRef.current);
      }
    }, 100);

    return () => {
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTime, time, onComplete, word]);

  const secondsLeft = Math.max(0, Math.round(time - elapsedTime / 1000));

  const handleDone = () => {
    void track('click_done_drawing');
    void track('drawing_done_manual');
    onComplete(drawingData);
  };

  const handleOpenColorPicker = () => {
    void track('click_color_picker_plus');
    setIsColorPickerOpen(true);
  };

  const handleCloseColorPicker = () => {
    setIsColorPickerOpen(false);
  };

  const handleSelectExtendedColor = (color: HEX) => {
    void track('select_extended_color');
    setCurrentColor(color);
    setIsColorPickerOpen(false);
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
    ctx.fillStyle = drawingData.colors[drawingData.bg] ?? '#FFFFFF';
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

        // Track first pixel drawn
        if (!hasTrackedFirstPixel.current) {
          void track('first_pixel_drawn');
          void track('drawing_first_pixel');
          hasTrackedFirstPixel.current = true;
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <main className="absolute inset-0 flex flex-col items-center justify-center p-6 gap-6">
      {/* Header */}
      <header className="flex flex-row items-center justify-center h-min w-full gap-3">
        <div className="flex flex-col items-start justify-center gap-1 w-full h-full flex-1">
          <Text scale={2.5}>{word}</Text>
          <div className="flex flex-row items-center gap-2 text-secondary">
            <Icon type="clock" />
            <Text scale={2}>{`${secondsLeft}s left`}</Text>
          </div>
        </div>

        <Button onClick={handleDone} size="medium">
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
            <Text scale={2} className="text-tertiary">
              Tap to draw
            </Text>
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
        {userLevel >= 2 && (
          <ColorPickerPlusButton onClick={handleOpenColorPicker} />
        )}
      </div>

      {/* Color Picker Modal */}
      <ColorPickerModal
        isOpen={isColorPickerOpen}
        onClose={handleCloseColorPicker}
        onSelectColor={handleSelectExtendedColor}
        currentColor={currentColor}
        userLevel={userLevel}
      />
    </main>
  );
}

type ColorSwatchProps = {
  color: HEX;
  isSelected: boolean;
  onSelect: (color: HEX) => void;
};

function ColorSwatch(props: ColorSwatchProps) {
  const { color, isSelected, onSelect } = props;

  return (
    <button
      onClick={() => {
        onSelect(color);
      }}
      className="w-8 h-8 border-4 border-black cursor-pointer transition-all flex items-center justify-center hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] shadow-pixel hover:shadow-pixel-sm active:shadow-none"
      style={{ backgroundColor: color }}
    >
      <Icon
        type="checkmark"
        scale={2}
        color={getContrastColor(color)}
        className={`transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}
      />
    </button>
  );
}

type ColorPickerPlusButtonProps = {
  onClick: () => void;
};

function ColorPickerPlusButton(props: ColorPickerPlusButtonProps) {
  const { onClick } = props;

  return (
    <button
      onClick={onClick}
      className="w-8 h-8 border-4 border-black cursor-pointer transition-all flex items-center justify-center hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] shadow-pixel hover:shadow-pixel-sm active:shadow-none bg-gray-200"
    >
      <Icon type="plus" scale={2} color="currentColor" />
    </button>
  );
}

type ColorPickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectColor: (color: HEX) => void;
  currentColor: HEX;
  userLevel: number;
};

function ColorPickerModal(props: ColorPickerModalProps) {
  const { isOpen, onClose, onSelectColor, currentColor, userLevel } = props;
  const availableColors = getAvailableExtendedColors(userLevel);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select a color">
      <div className="grid grid-cols-7 gap-2">
        {availableColors.map((color) => (
          <ColorSwatch
            key={color}
            color={color}
            isSelected={currentColor === color}
            onSelect={onSelectColor}
          />
        ))}
      </div>
    </Modal>
  );
}
