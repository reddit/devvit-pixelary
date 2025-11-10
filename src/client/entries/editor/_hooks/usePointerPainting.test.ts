import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/preact';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { usePointerPainting } from './usePointerPainting';
import { DrawingUtils } from '@shared/schema/drawing';

describe('usePointerPainting', () => {
  it('maps pointer to pixel and paints', () => {
    const canvasEl = document.createElement('canvas');
    Object.defineProperty(canvasEl, 'getBoundingClientRect', {
      value: () => ({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON: () => {},
      }),
    });
    const canvasRef = { current: canvasEl };
    const mainCanvasCssSizeRef = { current: { width: 100, height: 100 } };
    const drawAreaRef = { current: { x: 0, y: 0, size: 100 } };
    const drawingData = DrawingUtils.createBlank();
    const painted: Array<{ x: number; y: number; color: string }> = [];
    const pushUndoSnapshot = () => {};
    const onFirstPixel = () => {};
    const spawnAt = () => {};
    const { result } = renderHook(() =>
      usePointerPainting({
        canvasRef,
        mainCanvasCssSizeRef,
        drawAreaRef,
        drawingData,
        currentColor: '#000000',
        paintAt: (x, y, color) => painted.push({ x, y, color }),
        pushUndoSnapshot,
        onFirstPixel,
        spawnAt,
      })
    );
    const evt = {
      clientX: 10,
      clientY: 10,
      pointerId: 1,
      currentTarget: canvasEl,
      preventDefault: () => {},
    } as unknown as ReactPointerEvent<HTMLCanvasElement>;
    result.current.onPointerDown(evt);
    expect(painted.length).toBe(1);
  });
});
