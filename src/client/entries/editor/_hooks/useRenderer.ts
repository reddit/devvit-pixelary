import { useEffect } from 'react';
import { DrawingUtils, type DrawingData } from '@shared/schema/drawing';
import type { Size2D } from './useGeometry';
import type { HEX } from '@shared/types';
import type { RefObject } from 'react';

type MutableRef<T> = { current: T };

type UseRendererParams = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  drawingData: DrawingData;
  viewportSize: Size2D;
  isReviewing: boolean;
  layoutVersion: number;
  drawAreaRef: MutableRef<{ x: number; y: number; size: number }>;
  mainCanvasCssSizeRef: MutableRef<{ width: number; height: number }>;
  checkerboardCacheRef: MutableRef<Map<number, HTMLCanvasElement>>;
  applyDrawAreaCssVariables: (
    drawArea: { x: number; y: number; size: number },
    isReviewing: boolean
  ) => void;
};

export function useRenderer(params: UseRendererParams) {
  const {
    canvasRef,
    drawingData,
    viewportSize,
    isReviewing,
    layoutVersion,
    drawAreaRef,
    mainCanvasCssSizeRef,
    checkerboardCacheRef,
    applyDrawAreaCssVariables,
  } = params;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width: vw, height: vh } = viewportSize;
    if (vw <= 0 || vh <= 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    // Ensure CSS size matches viewport (draw coordinates in CSS pixels)
    canvas.style.width = `${vw}px`;
    canvas.style.height = `${vh}px`;
    // Use viewport size directly for layout to avoid transform-induced size drift
    const cssW = Math.max(1, Math.round(vw));
    const cssH = Math.max(1, Math.round(vh));
    // Set backing buffer to device pixels for crispness
    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));
    mainCanvasCssSizeRef.current = { width: cssW, height: cssH };

    // Draw in CSS pixel coordinates
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // Clear full canvas in CSS pixels
    ctx.clearRect(0, 0, cssW, cssH);

    // Placement using fixed insets from canvas edges
    const insetX = 16; // horizontal inset on each side
    const insetY = 100; // vertical inset on each side
    const allowedLeft = insetX;
    const allowedTop = insetY;
    const allowedW = Math.max(0, cssW - insetX * 2);
    const allowedH = Math.max(0, cssH - insetY * 2);

    // Ensure square fits within allowed area
    const s0 = Math.max(0, Math.min(allowedW, allowedH));
    let px = s0 / drawingData.size;
    let squareSize = s0;
    if (px >= 1) {
      const intPx = Math.floor(px);
      px = intPx;
      squareSize = intPx * drawingData.size;
    }
    // Center square within allowed rect
    let squareX = Math.round(allowedLeft + (allowedW - squareSize) / 2);
    let squareY = Math.round(allowedTop + (allowedH - squareSize) / 2);
    // Clamp to canvas CSS size to avoid off-screen rendering
    squareX = Math.max(0, Math.min(squareX, cssW - squareSize));
    squareY = Math.max(0, Math.min(squareY, cssH - squareSize));
    drawAreaRef.current = { x: squareX, y: squareY, size: squareSize };

    // Expose scaled draw square geometry via CSS variables for overlay positioning
    applyDrawAreaCssVariables(
      { x: squareX, y: squareY, size: squareSize },
      isReviewing
    );

    // Shadow (match pixel-shadow util: 4px offset, same color)
    const shadowOffset = 4;
    const cssRoot = getComputedStyle(document.documentElement);
    const shadowColor =
      cssRoot.getPropertyValue('--color-shadow').trim() || 'rgba(0, 0, 0, 0.3)';
    ctx.fillStyle = shadowColor;
    ctx.fillRect(
      squareX + shadowOffset,
      squareY + shadowOffset,
      squareSize,
      squareSize
    );

    // Background square
    ctx.fillStyle = drawingData.colors[drawingData.bg] ?? '#FFFFFF';
    ctx.fillRect(squareX, squareY, squareSize, squareSize);

    // Draw pixels
    const pixelColors = DrawingUtils.getAllPixelColors(drawingData);
    const pixelSize = squareSize / drawingData.size; // may be fractional on tiny viewports
    for (let pixelIndex = 0; pixelIndex < pixelColors.length; pixelIndex++) {
      const color = pixelColors[pixelIndex];
      if (color && color !== drawingData.colors[drawingData.bg]) {
        ctx.fillStyle = color as HEX;
        const pixelX = pixelIndex % drawingData.size;
        const pixelY = Math.floor(pixelIndex / drawingData.size);
        const x = squareX + pixelX * pixelSize;
        const y = squareY + pixelY * pixelSize;
        ctx.fillRect(x, y, pixelSize, pixelSize);
      }
    }

    // Checkerboard overlay (disabled during review) - blit from cached offscreen
    if (!isReviewing) {
      const size = drawingData.size;
      let overlay = checkerboardCacheRef.current.get(size);
      if (!overlay) {
        overlay = document.createElement('canvas');
        overlay.width = size;
        overlay.height = size;
        const octx = overlay.getContext('2d');
        if (octx) {
          octx.imageSmoothingEnabled = false;
          for (let px = 0; px < size; px++) {
            for (let py = 0; py < size; py++) {
              const isEven = (px + py) % 2 === 0;
              octx.fillStyle = isEven
                ? 'rgba(255, 255, 255, 0.05)'
                : 'rgba(0, 0, 0, 0.05)';
              octx.fillRect(px, py, 1, 1);
            }
          }
        }
        checkerboardCacheRef.current.set(size, overlay);
      }
      ctx.drawImage(overlay, squareX, squareY, squareSize, squareSize);
    }
  }, [
    canvasRef,
    drawingData,
    viewportSize,
    isReviewing,
    layoutVersion,
    drawAreaRef,
    mainCanvasCssSizeRef,
    checkerboardCacheRef,
    applyDrawAreaCssVariables,
  ]);
}
