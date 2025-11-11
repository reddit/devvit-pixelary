import type { TelemetryEventType } from '@shared/types';
import type React from 'react';
import { useTelemetry } from '@client/hooks/useTelemetry';
import { useDrawingState } from '../_hooks/useDrawingState';
import { Undo } from '@client/components/illustrations/Undo';
import { PaintBucket } from '@client/components/illustrations/PaintBucket';
import { BrushSize } from '@client/components/illustrations/BrushSize';
import { Mirror } from '@client/components/illustrations/Mirror';
import { PaintBrush } from '@client/components/illustrations/PaintBrush';

type ToolbarProps = {
  isReviewing?: boolean;
  hasEntered?: boolean;
};

export function Toolbar(props: ToolbarProps) {
  const { isReviewing = false, hasEntered = false } = props;
  const {
    canUndo,
    undo,
    brushSize,
    setBrushSize,
    mirrorV,
    setMirrorV,
    mirrorH,
    setMirrorH,
    toolMode,
    setToolMode,
  } = useDrawingState();

  return (
    <div
      className={`flex flex-row flex-nowrap gap-2 items-center justify-center transition-all duration-300 ease-out ${
        isReviewing ? 'delay-0' : 'delay-150'
      } ${
        isReviewing
          ? 'translate-y-4 opacity-0'
          : hasEntered
            ? 'translate-y-0 opacity-100'
            : 'translate-y-2 opacity-0'
      }`}
    >
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
        }}
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
      >
        <Mirror
          size={24}
          direction="vertical"
          variant={toolMode === 'draw' && mirrorH ? 'on' : 'off'}
        />
      </ToolbarButton>
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
};

function ToolbarButton(props: ToolbarButtonProps) {
  const { children, onClick, disabled, className, title, telemetryEvent } =
    props;
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
      className={`h-8 w-8 transition-all flex items-center justify-center   ${
        disabledClasses
      } ${className}`}
    >
      {children}
    </button>
  );
}
