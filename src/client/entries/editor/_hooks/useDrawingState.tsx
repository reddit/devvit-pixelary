import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { HEX } from '@shared/types';
import { DrawingUtils, type DrawingData } from '@shared/schema/drawing';

type BrushSize = 1 | 3 | 5;

type DrawingStateContextValue = {
  drawingData: DrawingData;
  brushSize: BrushSize;
  setBrushSize: (size: BrushSize) => void;
  mirrorV: boolean;
  setMirrorV: (value: boolean) => void;
  mirrorH: boolean;
  setMirrorH: (value: boolean) => void;
  canUndo: boolean;
  pushUndoSnapshot: () => void;
  undo: () => void;
  paintAt: (pixelX: number, pixelY: number, color: HEX) => void;
  fill: (color: HEX) => void;
  getDrawingData: () => DrawingData;
};

const DrawingStateContext = createContext<DrawingStateContextValue | null>(
  null
);

export function useDrawingState(): DrawingStateContextValue {
  const ctx = useContext(DrawingStateContext);
  if (!ctx)
    throw new Error('useDrawingState must be used within DrawingStateProvider');
  return ctx;
}

type ProviderProps = {
  initial?: DrawingData;
  children: React.ReactNode;
};

export function DrawingStateProvider(props: ProviderProps) {
  const { initial, children } = props;

  const [drawingData, setDrawingData] = useState<DrawingData>(
    () => initial ?? DrawingUtils.createBlank()
  );
  const drawingDataRef = useRef<DrawingData>(drawingData);
  drawingDataRef.current = drawingData;

  const [brushSize, setBrushSize] = useState<BrushSize>(1);
  const [mirrorV, setMirrorV] = useState(false);
  const [mirrorH, setMirrorH] = useState(false);
  const [undoStack, setUndoStack] = useState<DrawingData[]>([]);

  const pushUndoSnapshot = useCallback(() => {
    setUndoStack((stack) => [
      ...stack,
      {
        data: drawingDataRef.current.data,
        colors: [...drawingDataRef.current.colors],
        bg: drawingDataRef.current.bg,
        size: drawingDataRef.current.size,
      },
    ]);
  }, []);

  const undo = useCallback(() => {
    setDrawingData((prev) => {
      let restored: DrawingData | undefined;
      setUndoStack((s) => {
        const copy = [...s];
        const last = copy.pop();
        if (last) {
          restored = {
            data: last.data,
            colors: [...last.colors],
            bg: last.bg,
            size: last.size,
          };
        }
        return copy;
      });
      return restored ?? prev;
    });
  }, []);

  const paintAt = useCallback(
    (pixelX: number, pixelY: number, color: HEX) => {
      const size = drawingDataRef.current.size;
      const centers: Array<{ x: number; y: number }> = [
        { x: pixelX, y: pixelY },
      ];
      if (mirrorV) centers.push({ x: size - 1 - pixelX, y: pixelY });
      if (mirrorH) centers.push({ x: pixelX, y: size - 1 - pixelY });
      if (mirrorV && mirrorH)
        centers.push({ x: size - 1 - pixelX, y: size - 1 - pixelY });

      const half = (brushSize - 1) / 2;
      const indexSet = new Set<number>();
      for (const c of centers) {
        for (let dx = -half; dx <= half; dx++) {
          for (let dy = -half; dy <= half; dy++) {
            const px = c.x + dx;
            const py = c.y + dy;
            if (px >= 0 && py >= 0 && px < size && py < size) {
              indexSet.add(py * size + px);
            }
          }
        }
      }
      if (indexSet.size === 0) return;
      const pixels = [...indexSet].map((index) => ({ index, color }));
      setDrawingData((prev) => DrawingUtils.setPixels(prev, pixels));
    },
    [brushSize, mirrorV, mirrorH]
  );

  const fill = useCallback(
    (color: HEX) => {
      // snapshot
      (pushUndoSnapshot as () => void)();
      const total = drawingDataRef.current.size * drawingDataRef.current.size;
      const pixels = Array.from({ length: total }, (_, i) => ({
        index: i,
        color,
      }));
      setDrawingData((prev) => DrawingUtils.setPixels(prev, pixels));
    },
    [pushUndoSnapshot]
  );

  const value = useMemo<DrawingStateContextValue>(
    () => ({
      drawingData,
      brushSize,
      setBrushSize,
      mirrorV,
      setMirrorV,
      mirrorH,
      setMirrorH,
      canUndo: undoStack.length > 0,
      pushUndoSnapshot,
      undo,
      paintAt,
      fill,
      getDrawingData: () => drawingDataRef.current,
    }),
    [
      drawingData,
      brushSize,
      mirrorV,
      mirrorH,
      undoStack.length,
      pushUndoSnapshot,
      undo,
      paintAt,
      fill,
    ]
  );

  return (
    <DrawingStateContext.Provider value={value}>
      {children}
    </DrawingStateContext.Provider>
  );
}
