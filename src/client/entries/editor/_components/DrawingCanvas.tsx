import React from 'react';
import type { DrawingData } from '@shared/schema/drawing';
import type { Size2D, DrawArea } from '../_hooks/useGeometry';
import { useRenderer } from '../_hooks/useRenderer';
import type { RefObject } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

type MutableRef<T> = { current: T };

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
  // pointer handlers
  onPointerDown?: React.PointerEventHandler<HTMLCanvasElement>;
  onPointerMove?: React.PointerEventHandler<HTMLCanvasElement>;
  onPointerUp?: React.PointerEventHandler<HTMLCanvasElement>;
  onPointerLeave?: React.PointerEventHandler<HTMLCanvasElement>;
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
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
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
  });

  return (
    <canvas
      ref={canvasRef}
      className={className}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onMouseDown={(e) =>
        onPointerDown?.(e as unknown as ReactPointerEvent<HTMLCanvasElement>)
      }
      onMouseMove={(e) =>
        onPointerMove?.(e as unknown as ReactPointerEvent<HTMLCanvasElement>)
      }
      onMouseUp={(e) =>
        onPointerUp?.(e as unknown as ReactPointerEvent<HTMLCanvasElement>)
      }
      onMouseLeave={(e) =>
        onPointerLeave?.(e as unknown as ReactPointerEvent<HTMLCanvasElement>)
      }
    />
  );
}
