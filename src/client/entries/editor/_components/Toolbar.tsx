import type { HEX, TelemetryEventType } from '@shared/types';
import { useTelemetry } from '@client/hooks/useTelemetry';
import { useDrawingState } from '../_hooks/useDrawingState';
import { Undo } from '@client/components/illustrations/Undo';
import { Redo } from '@client/components/illustrations/Redo';
import { PaintBucket } from '@client/components/illustrations/PaintBucket';
import { Mirror } from '@client/components/illustrations/Mirror';
import { PaintBrush } from '@client/components/illustrations/PaintBrush';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getAllAvailableColors } from '@client/constants';
import { useRecentColors } from '../_hooks/useRecentColors';
import { useFlipRecentTiles } from '../_hooks/useFlipRecentTiles';
import { ColorPickerModal } from './ColorPickerModal';
import { getContrastColor } from '@shared/utils/color';
import { PaintSwatch } from '@client/components/illustrations/PaintSwatch';
import { ColorPalette } from '@client/components/illustrations';
import { Grid } from '@client/components/illustrations/Grid';

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
    canRedo,
    redo,
    brushSize,
    setBrushSize,
    mirrorV,
    setMirrorV,
    mirrorH,
    setMirrorH,
    toolMode,
    setToolMode,
    showGrid,
    setShowGrid,
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
          .slice(0, 6)
          .map((color, idx) => {
            const isSelected =
              idx === 0 && currentColor === color && !isMRUAnimating;
            return (
              <ToolbarButton
                key={color}
                title="Color"
                telemetryEvent="click_color_swatch"
                onClick={() => {
                  setCurrentColor(color);
                  updateRecentWithDrama(color);
                }}
                className="relative"
                ariaPressed={isSelected}
                dataColor={color}
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
              </ToolbarButton>
            );
          })}
        <ToolbarButton
          title="Color Picker"
          telemetryEvent="click_color_picker_plus"
          onClick={handleOpenColorPicker}
        >
          <ColorPalette size={24} />
        </ToolbarButton>
        <ToolbarButton
          title="Grid"
          telemetryEvent="click_toggle_grid"
          onClick={() => {
            setShowGrid(!showGrid);
          }}
          ariaPressed={showGrid}
        >
          <Grid size={24} variant={showGrid ? 'on' : 'off'} />
        </ToolbarButton>
      </div>

      {/* Bottom Row: Tools */}
      <div className="flex flex-row flex-nowrap items-center justify-center">
        {/* Undo Tool */}
        <ToolbarButton title="Undo" telemetryEvent="click_undo" onClick={undo}>
          <Undo size={24} variant={canUndo ? 'on' : 'off'} />
        </ToolbarButton>
        {/* Redo Tool */}
        <ToolbarButton title="Redo" telemetryEvent="click_redo" onClick={redo}>
          <Redo size={24} variant={canRedo ? 'on' : 'off'} />
        </ToolbarButton>

        {/* Paint Bucket Tool */}
        <ToolbarButton
          title="Fill"
          telemetryEvent="click_fill"
          onClick={() => {
            setToolMode('fill');
          }}
          ariaPressed={toolMode === 'fill'}
        >
          <PaintBucket size={24} variant={toolMode === 'fill' ? 'on' : 'off'} />
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
          <PaintBrush
            size={24}
            brushSize="small"
            variant={toolMode === 'draw' && brushSize === 1 ? 'on' : 'off'}
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
          <PaintBrush
            size={24}
            brushSize="medium"
            variant={toolMode === 'draw' && brushSize === 3 ? 'on' : 'off'}
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
          <PaintBrush
            size={24}
            brushSize="large"
            variant={toolMode === 'draw' && brushSize === 5 ? 'on' : 'off'}
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
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  title?: string;
  telemetryEvent: TelemetryEventType;
  ariaPressed?: boolean;
  dataColor?: string;
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
    dataColor,
  } = props;
  const { track } = useTelemetry();

  const disabledClasses = disabled
    ? 'opacity-50 cursor-not-allowed'
    : 'cursor-pointer hover:scale-120 active:scale-90';

  return (
    <button
      disabled={disabled}
      onClick={() => {
        void track(telemetryEvent);
        onClick();
      }}
      title={title}
      aria-label={title}
      data-color={dataColor}
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
