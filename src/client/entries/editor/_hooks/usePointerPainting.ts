import { useMemo, useRef } from 'react';
import type { RefObject, PointerEvent as ReactPointerEvent } from 'react';
import type { HEX } from '@shared/types';
import type { DrawArea } from './useGeometry';
import type { DrawingData } from '@shared/schema/drawing';

type MutableRef<T> = { current: T };
type ToolMode = 'draw' | 'fill';

type Params = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  mainCanvasCssSizeRef: MutableRef<{ width: number; height: number }>;
  drawAreaRef: MutableRef<DrawArea>;
  drawingData: DrawingData;
  currentColor: HEX;
  paintAt: (pixelX: number, pixelY: number, color: HEX) => void;
  floodFillAt: (pixelX: number, pixelY: number, color: HEX) => void;
  pushUndoSnapshot: () => void;
  onFirstPixel: () => void;
  spawnAt: (x: number, y: number, color: HEX, pixelSizeCss: number) => void;
  toolMode: ToolMode;
};

export function usePointerPainting(params: Params) {
  const {
    canvasRef,
    mainCanvasCssSizeRef,
    drawAreaRef,
    drawingData,
    currentColor,
    paintAt,
    floodFillAt,
    pushUndoSnapshot,
    onFirstPixel,
    spawnAt,
    toolMode,
  } = params;

  const isDrawingRef = useRef(false);
  const hasPushedUndoForStrokeRef = useRef(false);
  const lastPaintedIndexRef = useRef<number | null>(null);
  const hasTrackedFirstPixelRef = useRef(false);

  function mapClientToPixel(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const cssBase = mainCanvasCssSizeRef.current;
    const scaleX = cssBase.width > 0 ? rect.width / cssBase.width : 1;
    const scaleY = cssBase.height > 0 ? rect.height / cssBase.height : 1;
    const x = (clientX - rect.left) / (scaleX || 1);
    const y = (clientY - rect.top) / (scaleY || 1);

    const { x: sx, y: sy, size: ss } = drawAreaRef.current;
    if (ss <= 0) return null;
    const relX = x - sx;
    const relY = y - sy;
    if (relX < 0 || relY < 0 || relX >= ss || relY >= ss) return null;

    const pixelX = Math.min(
      drawingData.size - 1,
      Math.floor((relX / ss) * drawingData.size)
    );
    const pixelY = Math.min(
      drawingData.size - 1,
      Math.floor((relY / ss) * drawingData.size)
    );
    const index = pixelY * drawingData.size + pixelX;
    const pixelSize = ss / drawingData.size;
    const cx = sx + pixelX * pixelSize + pixelSize / 2;
    const cy = sy + pixelY * pixelSize + pixelSize / 2;
    return {
      pixelX,
      pixelY,
      index,
      pixelCenterX: cx,
      pixelCenterY: cy,
      pixelSize,
    };
  }

  const handlers = useMemo(() => {
    return {
      onPointerDown: (e: ReactPointerEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        // Fill mode: single click flood-fill
        if (toolMode === 'fill') {
          const mapped = mapClientToPixel(e.clientX, e.clientY);
          if (mapped) {
            const { pixelX, pixelY, pixelCenterX, pixelCenterY, pixelSize } =
              mapped;
            spawnAt(pixelCenterX, pixelCenterY, currentColor, pixelSize);
            floodFillAt(pixelX, pixelY, currentColor);
            if (!hasTrackedFirstPixelRef.current) {
              onFirstPixel();
              hasTrackedFirstPixelRef.current = true;
            }
          }
          return;
        }
        const target = e.currentTarget;
        type PointerCaptureTarget = {
          setPointerCapture?: (pointerId: number) => void;
          releasePointerCapture?: (pointerId: number) => void;
        };
        const el = target as unknown as PointerCaptureTarget;
        if (el.setPointerCapture) {
          el.setPointerCapture(e.pointerId);
        }
        isDrawingRef.current = true;
        if (!hasPushedUndoForStrokeRef.current) {
          hasPushedUndoForStrokeRef.current = true;
          pushUndoSnapshot();
        }
        const mapped = mapClientToPixel(e.clientX, e.clientY);
        if (mapped) {
          const {
            pixelX,
            pixelY,
            index,
            pixelCenterX,
            pixelCenterY,
            pixelSize,
          } = mapped;
          lastPaintedIndexRef.current = index;
          spawnAt(pixelCenterX, pixelCenterY, currentColor, pixelSize);
          paintAt(pixelX, pixelY, currentColor);
          if (!hasTrackedFirstPixelRef.current) {
            onFirstPixel();
            hasTrackedFirstPixelRef.current = true;
          }
        }
      },
      onPointerMove: (e: ReactPointerEvent<HTMLCanvasElement>) => {
        if (toolMode === 'fill') return; // no dragging in fill mode
        if (!isDrawingRef.current) return;
        e.preventDefault();
        const mapped = mapClientToPixel(e.clientX, e.clientY);
        if (mapped) {
          const {
            pixelX,
            pixelY,
            index,
            pixelCenterX,
            pixelCenterY,
            pixelSize,
          } = mapped;
          if (index !== lastPaintedIndexRef.current) {
            lastPaintedIndexRef.current = index;
            spawnAt(pixelCenterX, pixelCenterY, currentColor, pixelSize);
          }
          paintAt(pixelX, pixelY, currentColor);
        }
      },
      onPointerUp: (e: ReactPointerEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        isDrawingRef.current = false;
        lastPaintedIndexRef.current = null;
        hasPushedUndoForStrokeRef.current = false;
        {
          const el = e.currentTarget as unknown as {
            releasePointerCapture?: (pointerId: number) => void;
          };
          if (el.releasePointerCapture) {
            el.releasePointerCapture(e.pointerId);
          }
        }
      },
      onPointerLeave: (e: ReactPointerEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        isDrawingRef.current = false;
        lastPaintedIndexRef.current = null;
        hasPushedUndoForStrokeRef.current = false;
      },
    };
    // Dependencies intentionally static; internal refs capture latest values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentColor,
    paintAt,
    floodFillAt,
    pushUndoSnapshot,
    onFirstPixel,
    spawnAt,
    toolMode,
  ]);

  return handlers;
}
