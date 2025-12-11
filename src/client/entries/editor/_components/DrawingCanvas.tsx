import React from 'react';
import type { DrawingData } from '@shared/schema/drawing';
import type { Size2D, DrawArea } from '../_hooks/useGeometry';
import { useRenderer } from '../_hooks/useRenderer';
import type { RefObject } from 'react';
/**/

type MutableRef<T> = { current: T };

type PointerHandler = (e: PointerEvent) => void;

type DrawingCanvasProps = {
  isReviewing: boolean;
  viewportSize: Size2D;
  layoutVersion: number;
  drawingData: DrawingData;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  drawAreaRef: MutableRef<DrawArea>;
  mainCanvasCssSizeRef: MutableRef<{ width: number; height: number }>;
  checkerboardCacheRef: MutableRef<Map<number, HTMLCanvasElement>>;
  applyDrawAreaCssVariables: (drawArea: DrawArea, isReviewing: boolean) => void;
  showGrid?: boolean;
  // pointer handlers
  onPointerDown?: PointerHandler;
  onPointerMove?: PointerHandler;
  onPointerUp?: PointerHandler;
  onPointerLeave?: PointerHandler;
  onPointerCancel?: PointerHandler;
  onLostPointerCapture?: PointerHandler;
  className?: string;
};

export function DrawingCanvas(props: DrawingCanvasProps) {
  const {
    isReviewing,
    viewportSize,
    layoutVersion,
    drawingData,
    canvasRef,
    drawAreaRef,
    mainCanvasCssSizeRef,
    checkerboardCacheRef,
    applyDrawAreaCssVariables,
    showGrid,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    onPointerCancel,
    onLostPointerCapture,
    className,
  } = props;

  useRenderer({
    canvasRef,
    drawingData,
    viewportSize,
    isReviewing,
    layoutVersion,
    drawAreaRef,
    mainCanvasCssSizeRef,
    checkerboardCacheRef,
    applyDrawAreaCssVariables,
    showGrid,
  });

  return (
    <canvas
      ref={canvasRef}
      className={`${className} touch-none`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onLostPointerCapture}
      onMouseDown={(e) => onPointerDown?.(e as unknown as PointerEvent)}
      onMouseMove={(e) => onPointerMove?.(e as unknown as PointerEvent)}
      onMouseUp={(e) => onPointerUp?.(e as unknown as PointerEvent)}
      onMouseLeave={(e) => onPointerLeave?.(e as unknown as PointerEvent)}
    />
  );
}
