import { useCallback, useEffect, useState } from 'react';

export type Size2D = { width: number; height: number };
export type DrawArea = { x: number; y: number; size: number };

export function useGeometry() {
  const [viewportSize, setViewportSize] = useState<Size2D>({
    width: 0,
    height: 0,
  });

  // Track viewport size for full-screen canvas layer
  useEffect(() => {
    const update = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  const applyDrawAreaCssVariables = useCallback(
    (drawArea: DrawArea, isReviewing: boolean) => {
      const { width: vw, height: vh } = viewportSize;
      if (vw <= 0 || vh <= 0) return;
      const { x, y, size } = drawArea;
      if (size <= 0) return;
      const scale = isReviewing ? 0.88 : 1;
      const topScaled = y * scale + (1 - scale) * (vh / 2);
      const leftScaled = x * scale + (1 - scale) * (vw / 2);
      const sizeScaled = size * scale;
      const root = document.documentElement;
      root.style.setProperty('--draw-top', `${topScaled}px`);
      root.style.setProperty('--draw-left', `${leftScaled}px`);
      root.style.setProperty('--draw-size', `${sizeScaled}px`);
    },
    [viewportSize]
  );

  // Cleanup CSS variables on unmount to avoid leaking state across views
  useEffect(() => {
    return () => {
      const root = document.documentElement;
      root.style.removeProperty('--draw-top');
      root.style.removeProperty('--draw-left');
      root.style.removeProperty('--draw-size');
    };
  }, []);

  return { viewportSize, applyDrawAreaCssVariables };
}
