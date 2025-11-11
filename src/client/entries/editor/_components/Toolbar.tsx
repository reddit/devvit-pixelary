import type { HEX, TelemetryEventType } from '@shared/types';
import { useTelemetry } from '@client/hooks/useTelemetry';
import { useDrawingState } from '../_hooks/useDrawingState';
import { Undo } from '@client/components/illustrations/Undo';
import { PaintBucket } from '@client/components/illustrations/PaintBucket';
import { BrushSize } from '@client/components/illustrations/BrushSize';
import { Mirror } from '@client/components/illustrations/Mirror';

type ToolbarProps = {
  isReviewing?: boolean;
  hasEntered?: boolean;
  currentColor: HEX;
};

export function Toolbar(props: ToolbarProps) {
  const { isReviewing = false, hasEntered = false, currentColor } = props;
  const {
    canUndo,
    undo,
    fill,
    brushSize,
    setBrushSize,
    mirrorV,
    setMirrorV,
    mirrorH,
    setMirrorH,
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
      <ToolbarButton
        title="Undo"
        telemetryEvent="click_undo"
        disabled={!canUndo}
        onClick={undo}
        active={canUndo}
      >
        <Undo size={24} variant={canUndo ? 'on' : 'off'} />
      </ToolbarButton>

      {/* Paint Bucket Tool */}
      <ToolbarButton
        title="Fill"
        telemetryEvent="click_fill"
        onClick={() => fill(currentColor)}
        active
      >
        <PaintBucket size={24} variant={!isReviewing ? 'on' : 'off'} />
      </ToolbarButton>

      {/* Brush Size: Small */}
      <ToolbarButton
        title="Brush Small"
        telemetryEvent="toggle_brush_size"
        onClick={() => setBrushSize(1)}
        active={brushSize === 1}
      >
        <BrushSize
          size={24}
          brushSize="small"
          brushVariant={brushSize === 1 ? 'on' : 'off'}
        />
      </ToolbarButton>

      {/* Brush Size: Medium */}
      <ToolbarButton
        title="Brush Medium"
        telemetryEvent="toggle_brush_size"
        active={brushSize === 3}
        onClick={() => setBrushSize(3)}
      >
        <BrushSize
          size={24}
          brushSize="medium"
          brushVariant={brushSize === 3 ? 'on' : 'off'}
        />
      </ToolbarButton>

      {/* Brush Size: Large */}
      <ToolbarButton
        title="Brush Large"
        telemetryEvent="toggle_brush_size"
        active={brushSize === 5}
        onClick={() => setBrushSize(5)}
      >
        <BrushSize
          size={24}
          brushSize="large"
          brushVariant={brushSize === 5 ? 'on' : 'off'}
        />
      </ToolbarButton>

      {/* Mirror Vertical */}
      <ToolbarButton
        title="Mirror Vertical"
        telemetryEvent="toggle_mirror_v"
        active={mirrorV}
        onClick={() => setMirrorV(!mirrorV)}
      >
        <Mirror
          size={24}
          direction="horizontal"
          variant={mirrorV ? 'on' : 'off'}
        />
      </ToolbarButton>

      {/* Mirror Horizontal */}
      <ToolbarButton
        title="Mirror Horizontal"
        telemetryEvent="toggle_mirror_h"
        onClick={() => setMirrorH(!mirrorH)}
        active={mirrorH}
      >
        <Mirror
          size={24}
          direction="vertical"
          variant={mirrorH ? 'on' : 'off'}
        />
      </ToolbarButton>
    </div>
  );
}

type ToolbarButtonProps = {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  title?: string;
  telemetryEvent: TelemetryEventType;
};

function ToolbarButton(props: ToolbarButtonProps) {
  const {
    children,
    onClick,
    active,
    disabled,
    className,
    title,
    telemetryEvent,
  } = props;
  const { track } = useTelemetry();

  const disabledClasses = disabled
    ? 'opacity-50 cursor-not-allowed'
    : 'cursor-pointer';

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
