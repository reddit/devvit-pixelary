import type { HEX, TelemetryEventType } from '@shared/types';
import type React from 'react';
import { useTelemetry } from '@client/hooks/useTelemetry';
import { useDrawingState } from '../_hooks/useDrawingState';
import { Undo } from '@client/components/illustrations/Undo';
import { PaintBucket } from '@client/components/illustrations/PaintBucket';
import { BrushSize } from '@client/components/illustrations/BrushSize';
import { Mirror } from '@client/components/illustrations/Mirror';
import { PaintBrush } from '@client/components/illustrations/PaintBrush';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getAllAvailableColors } from '@client/constants';
import { useRecentColors } from '../_hooks/useRecentColors';
import { useFlipRecentTiles } from '../_hooks/useFlipRecentTiles';
import { ColorPickerModal } from './ColorPickerModal';
import { getContrastColor } from '@shared/utils/color';
import { PaintSwatch } from '@client/components/illustrations/PaintSwatch';
import { ColorPalette } from '@client/components/illustrations';

type ToolbarProps = {
  isReviewing?: boolean;
  hasEntered?: boolean;
  userLevel?: number;
  onColorChange?: (color: HEX) => void;
};

export function Toolbar(props: ToolbarProps) {
  const {
    isReviewing = false,
    hasEntered = false,
    userLevel = 0,
    onColorChange,
  } = props;
  const {
    canUndo,
    undo,
    brushSize,
    setBrushSize,
    pushUndoSnapshot,
    fill,
    mirrorV,
    setMirrorV,
    mirrorH,
    setMirrorH,
    toolMode,
    setToolMode,
  } = useDrawingState();
  const paletteRef = useRef<HTMLDivElement>(null);
  const { track } = useTelemetry();

  // Palette state (folded from Palette.tsx)
  const {
    currentColor,
    setCurrentColor,
    recentColors,
    updateRecentWithDrama,
    isMRUAnimating,
    suppressInitialAnim,
  } = useRecentColors(paletteRef);

  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
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
    updateRecentWithDrama(color);
  };

  // Notify parent when current color changes
  useEffect(() => {
    if (onColorChange) onColorChange(currentColor);
  }, [currentColor, onColorChange]);

  const allowedColorsSet = useMemo(
    () => new Set(getAllAvailableColors(userLevel)),
    [userLevel]
  );

  // Activate FLIP for the recent palette (depends on recentColors array content)
  useFlipRecentTiles(
    paletteRef,
    [recentColors, userLevel, currentColor, suppressInitialAnim],
    {
      selectedKey: currentColor,
      suppress: suppressInitialAnim,
    }
  );

  return (
    <div
      className={`flex flex-col items-center justify-center transition-all duration-300 ease-out ${
        isReviewing ? 'delay-0' : 'delay-150'
      } ${
        isReviewing
          ? 'translate-y-4 opacity-0'
          : hasEntered
            ? 'translate-y-0 opacity-100'
            : 'translate-y-2 opacity-0'
      }`}
    >
      {/* Top Row: Color Palette */}
      <div
        className="flex flex-row items-center justify-center"
        data-mru-row
        ref={paletteRef}
      >
        {recentColors
          .filter((color) => allowedColorsSet.has(color))
          .map((color, idx) => (
            <ColorSwatch
              key={color}
              dataAttrKey={color}
              onSelect={(selected) => {
                void track('click_color_swatch');
                setCurrentColor(selected);
                updateRecentWithDrama(selected);
              }}
              color={color}
              isSelected={
                idx === 0 && currentColor === color && !isMRUAnimating
              }
            />
          ))}
        <ColorPickerButton onClick={handleOpenColorPicker} />
      </div>

      {/* Bottom Row: Tools */}
      <div className="flex flex-row flex-nowrap items-center justify-center">
        {/* Undo Tool */}
        <ToolbarButton title="Undo" telemetryEvent="click_undo" onClick={undo}>
          <Undo size={24} variant={canUndo ? 'on' : 'off'} />
        </ToolbarButton>

        {/* Paint Bucket Tool */}
        <ToolbarButton
          title="Fill"
          telemetryEvent="click_fill"
          onClick={() => {
            setToolMode('fill');
            pushUndoSnapshot();
            fill(currentColor);
          }}
          ariaPressed={toolMode === 'fill'}
        >
          <PaintBucket size={24} variant={toolMode === 'fill' ? 'on' : 'off'} />
        </ToolbarButton>

        {/* Draw Tool */}
        <ToolbarButton
          title="Draw"
          telemetryEvent="click_draw"
          onClick={() => {
            setToolMode('draw');
          }}
        >
          <PaintBrush size={24} variant={toolMode === 'draw' ? 'on' : 'off'} />
        </ToolbarButton>

        {/* Brush Size: Small */}
        <ToolbarButton
          title="Brush Small"
          telemetryEvent="toggle_brush_size"
          onClick={() => {
            if (toolMode === 'fill') setToolMode('draw');
            setBrushSize(1);
          }}
          ariaPressed={toolMode === 'draw' && brushSize === 1}
        >
          <BrushSize
            size={24}
            brushSize="small"
            brushVariant={toolMode === 'draw' && brushSize === 1 ? 'on' : 'off'}
          />
        </ToolbarButton>

        {/* Brush Size: Medium */}
        <ToolbarButton
          title="Brush Medium"
          telemetryEvent="toggle_brush_size"
          onClick={() => {
            if (toolMode === 'fill') setToolMode('draw');
            setBrushSize(3);
          }}
          ariaPressed={toolMode === 'draw' && brushSize === 3}
        >
          <BrushSize
            size={24}
            brushSize="medium"
            brushVariant={toolMode === 'draw' && brushSize === 3 ? 'on' : 'off'}
          />
        </ToolbarButton>

        {/* Brush Size: Large */}
        <ToolbarButton
          title="Brush Large"
          telemetryEvent="toggle_brush_size"
          onClick={() => {
            if (toolMode === 'fill') setToolMode('draw');
            setBrushSize(5);
          }}
          ariaPressed={toolMode === 'draw' && brushSize === 5}
        >
          <BrushSize
            size={24}
            brushSize="large"
            brushVariant={toolMode === 'draw' && brushSize === 5 ? 'on' : 'off'}
          />
        </ToolbarButton>

        {/* Mirror Vertical */}
        <ToolbarButton
          title="Mirror Vertical"
          telemetryEvent="toggle_mirror_v"
          onClick={() => {
            if (toolMode === 'fill') setToolMode('draw');
            setMirrorV(!mirrorV);
          }}
          ariaPressed={toolMode === 'draw' && mirrorV}
        >
          <Mirror
            size={24}
            direction="horizontal"
            variant={toolMode === 'draw' && mirrorV ? 'on' : 'off'}
          />
        </ToolbarButton>

        {/* Mirror Horizontal */}
        <ToolbarButton
          title="Mirror Horizontal"
          telemetryEvent="toggle_mirror_h"
          onClick={() => {
            if (toolMode === 'fill') setToolMode('draw');
            setMirrorH(!mirrorH);
          }}
          ariaPressed={toolMode === 'draw' && mirrorH}
        >
          <Mirror
            size={24}
            direction="vertical"
            variant={toolMode === 'draw' && mirrorH ? 'on' : 'off'}
          />
        </ToolbarButton>
      </div>

      {/* Color Picker Modal */}
      <ColorPickerModal
        isOpen={isColorPickerOpen}
        onClose={handleCloseColorPicker}
        onSelectColor={handleSelectExtendedColor}
        currentColor={currentColor}
        userLevel={userLevel}
      />
    </div>
  );
}

type ToolbarButtonProps = {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  title?: string;
  telemetryEvent: TelemetryEventType;
  ariaPressed?: boolean;
};

function ToolbarButton(props: ToolbarButtonProps) {
  const {
    children,
    onClick,
    disabled,
    className,
    title,
    telemetryEvent,
    ariaPressed,
  } = props;
  const { track } = useTelemetry();

  const disabledClasses = disabled
    ? 'opacity-50 cursor-not-allowed'
    : 'cursor-pointer hover:scale-110 active:scale-90';

  return (
    <button
      disabled={disabled}
      onClick={() => {
        void track(telemetryEvent);
        onClick();
      }}
      title={title}
      aria-label={title}
      aria-pressed={
        ariaPressed === undefined ? undefined : ariaPressed ? 'true' : 'false'
      }
      className={`h-10 w-10 transition-all flex items-center justify-center   ${
        disabledClasses
      } ${className}`}
    >
      {children}
    </button>
  );
}

// Local components folded from ColorSwatch.tsx and ColorPickerButton.tsx
type ColorSwatchProps = {
  color: HEX;
  isSelected: boolean;
  onSelect: (color: HEX) => void;
  dataAttrKey?: string;
};

function ColorSwatch(props: ColorSwatchProps) {
  const { color, isSelected, onSelect, dataAttrKey } = props;

  return (
    <button
      onClick={() => {
        onSelect(color);
      }}
      data-color={dataAttrKey}
      className="w-10 h-10 cursor-pointer transition-all flex items-center justify-center relative"
    >
      <PaintSwatch size={24} color={color} />
      <svg
        width="12"
        height="10"
        viewBox="0 0 12 10"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mru-check transition-opacity duration-200 ${isSelected ? 'opacity-100' : 'opacity-0'}`}
      >
        <path
          d="M12 4H10V6H8V8H6V10H4V8H2V6H0V4H4V6H6V4H8V2H10V0H12V4Z"
          fill={getContrastColor(color)}
        />
      </svg>
    </button>
  );
}

type ColorPickerButtonProps = {
  onClick: () => void;
};

function ColorPickerButton(props: ColorPickerButtonProps) {
  const { onClick } = props;

  return (
    <button
      onClick={onClick}
      className="w-10 h-10 cursor-pointer flex items-center justify-center"
    >
      <ColorPalette size={24} />
    </button>
  );
}
