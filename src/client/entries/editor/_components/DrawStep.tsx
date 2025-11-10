import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
} from 'react';
import { Button } from '@components/Button';
import { Icon } from '@components/PixelFont';
import { DRAWING_COLORS, getAllAvailableColors } from '@client/constants';
import { Text } from '@components/PixelFont';
import { DrawingUtils, type DrawingData } from '@shared/schema/drawing';
import { getContrastColor } from '@shared/utils/color';
import type { HEX } from '@shared/types';
import { useTelemetry } from '@client/hooks/useTelemetry';
import type { SlateAction } from '@shared/types';
import { trpc } from '@client/trpc/client';
import { useMemo } from 'react';
import { ColorPickerModal } from './ColorPickerModal';
import { ColorSwatch } from './ColorSwatch';
import { ColorPickerPlusButton } from './ColorPickerPlusButton';
import { useFlipRecentTiles } from './useFlipRecentTiles';

type DrawStepProps = {
  word: string;
  time: number;
  onComplete: (drawing: DrawingData) => void;
  slateId: string | null;
  trackSlateAction: (
    action: SlateAction,
    word?: string,
    metadata?: Record<string, string | number>
  ) => Promise<void>;
  userLevel: number;
  isReviewing?: boolean;
};

export function DrawStep(props: DrawStepProps) {
  const {
    word,
    time,
    onComplete,
    slateId,
    trackSlateAction,
    userLevel,
    isReviewing = false,
  } = props;

  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [hasEntered, setHasEntered] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState(0);

  const { track } = useTelemetry();

  // Track draw step view on mount - use ref to ensure it only runs once
  const hasTrackedView = useRef(false);
  useEffect(() => {
    if (!hasTrackedView.current) {
      void track('view_draw_step');
      void track('drawing_start');
      hasTrackedView.current = true;
    }
  }, [track, trackSlateAction, word, slateId]);

  // Entry animation trigger
  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      setHasEntered(true);
    });
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);

  // After entry transition ends, recompute layout to avoid post-click resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const particleCanvas = particleCanvasRef.current;
    if (!canvas && !particleCanvas) return;

    const onTransitionEnd = (e: TransitionEvent) => {
      if (e.propertyName === 'transform' || e.propertyName === 'opacity') {
        setLayoutVersion((v) => v + 1);
      }
    };
    canvas?.addEventListener('transitionend', onTransitionEnd);
    particleCanvas?.addEventListener('transitionend', onTransitionEnd);
    return () => {
      canvas?.removeEventListener('transitionend', onTransitionEnd);
      particleCanvas?.removeEventListener('transitionend', onTransitionEnd);
    };
  }, []);

  // Canvas state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const [currentColor, setCurrentColor] = useState<HEX>(DRAWING_COLORS[0]);
  const [recentColors, setRecentColors] = useState<HEX[]>(() =>
    DRAWING_COLORS.slice(0, 6)
  );
  const [isMRUAnimating, setIsMRUAnimating] = useState(false);
  const [suppressInitialAnim, setSuppressInitialAnim] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingData, setDrawingData] = useState<DrawingData>(() =>
    DrawingUtils.createBlank()
  );
  const hasTrackedFirstPixel = useRef(false);
  const drawingDataRef = useRef<DrawingData>(DrawingUtils.createBlank());
  const mainCanvasCssSizeRef = useRef<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  }>({
    width: 0,
    height: 0,
  });
  const [viewportSize, setViewportSize] = useState<{
    width: number;
    height: number;
  }>({
    width: 0,
    height: 0,
  });

  // debug logging removed

  // Editor tools & history state
  const [brushSize, setBrushSize] = useState<1 | 3 | 5>(1);
  const [mirrorV, setMirrorV] = useState(false);
  const [mirrorH, setMirrorH] = useState(false);
  const [undoStack, setUndoStack] = useState<DrawingData[]>([]);
  const hasPushedUndoForStrokeRef = useRef(false);

  // Geometry of the drawable square inside the canvas (in CSS pixels)
  const drawAreaRef = useRef<{
    x: number;
    y: number;
    size: number;
  }>({ x: 0, y: 0, size: 0 });

  // Particle canvas and state
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);
  const particleCanvasCssSizeRef = useRef<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const animationFrameRef = useRef<number | null>(null);
  const particleLoopStarterRef = useRef<(() => void) | null>(null);
  const lastPaintedIndexRef = useRef<number | null>(null);
  const lastSpawnTimeRef = useRef<number>(0);
  const checkerboardCacheRef = useRef<Map<number, HTMLCanvasElement>>(
    new Map()
  );
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  type Particle = {
    x: number; // CSS px
    y: number; // CSS px
    vx: number; // CSS px/s
    vy: number; // CSS px/s
    age: number; // seconds
    ttl: number; // seconds
    size: number; // CSS px
    color: HEX;
  };
  const particlesRef = useRef<Particle[]>([]);

  // Color picker modal state
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  // Non-blocking MRU write scheduling
  const pushRecentMutation = trpc.app.user.colors.pushRecent.useMutation();
  const schedulePushRecent = useCallback(
    (color: HEX) => {
      try {
        // Fire-and-forget; do not await, save every selection immediately
        pushRecentMutation.mutate({ color });
      } catch {
        // ignore best-effort errors
      }
    },
    [pushRecentMutation]
  );

  // Fetch recent colors (non-blocking; reconcile after initial seed)
  const didInitCurrentRef = useRef(false);
  const recentQuery = trpc.app.user.colors.getRecent.useQuery(undefined, {
    staleTime: 0,
    cacheTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (recentQuery.isSuccess && Array.isArray(recentQuery.data)) {
      const colors = recentQuery.data;
      setRecentColors(colors.slice(0, 6));
      if (!didInitCurrentRef.current) {
        if (colors.length > 0) {
          setCurrentColor(colors[0]);
          didInitCurrentRef.current = true;
          // After applying the first server MRU, turn off suppression
          setSuppressInitialAnim(false);
        }
      }
    }
  }, [
    recentQuery.isFetching,
    recentQuery.isSuccess,
    recentQuery.isError,
    recentQuery.data,
  ]);

  // Dramatic removal animation for oldest tile before clamping list
  function animateRemovalIfNeeded(prev: HEX[], next: HEX[]): Promise<void> {
    const container = paletteRef.current;
    if (!container) return Promise.resolve();
    if (prev.length === next.length) return Promise.resolve();
    const removed = prev.find((c) => !next.includes(c));
    if (!removed) return Promise.resolve();
    const el = container.querySelector<HTMLElement>(
      `[data-color="${removed}"]`
    );
    if (!el) return Promise.resolve();
    return new Promise((resolve) => {
      el.style.willChange = 'transform, opacity';
      el.style.transition = 'transform 220ms ease, opacity 180ms ease';
      el.style.transform = 'scale(0.7) translateY(6px)';
      el.style.opacity = '0';
      const onEnd = () => {
        el.style.transition = '';
        el.removeEventListener('transitionend', onEnd);
        resolve();
      };
      el.addEventListener('transitionend', onEnd);
    });
  }

  // Helper: dramatic MRU update with removal animation and non-blocking write
  function updateRecentWithDrama(color: HEX) {
    setRecentColors((prev) => {
      const already = prev.includes(color);
      const merged = [color, ...prev.filter((c) => c !== color)];
      const next = merged.slice(0, 6);
      if (!already && prev.length >= 6) {
        setIsMRUAnimating(true);
        void animateRemovalIfNeeded(prev, next).then(() => {
          setRecentColors(next);
          setIsMRUAnimating(false);
        });
        schedulePushRecent(color);
        return prev;
      }
      schedulePushRecent(color);
      return next;
    });
  }

  // Activate FLIP for the recent palette (depends on recentColors array content)
  useFlipRecentTiles(
    paletteRef,
    [recentColors, userLevel, currentColor, suppressInitialAnim],
    {
      selectedKey: currentColor,
      suppress: suppressInitialAnim,
    }
  );

  const allowedColorsSet = useMemo(
    () => new Set(getAllAvailableColors(userLevel)),
    [userLevel]
  );

  // Observe container size to size canvas accordingly
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        setContainerSize({ width: cr.width, height: cr.height });
      }
    });
    observer.observe(el);
    // Initialize immediately
    const rect = el.getBoundingClientRect();
    setContainerSize({ width: rect.width, height: rect.height });
    return () => {
      observer.disconnect();
    };
  }, []);

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

  // Keep drawingDataRef in sync with drawingData state
  useEffect(() => {
    drawingDataRef.current = drawingData;
  }, [drawingData]);

  // Size particle canvas to viewport and set crisp transform
  useEffect(() => {
    const canvas = particleCanvasRef.current;
    if (!canvas) return;
    const { width: vw, height: vh } = viewportSize;
    if (vw <= 0 || vh <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${vw}px`;
    canvas.style.height = `${vh}px`;
    // Use base viewport size (pre-transform) to match main canvas coordinate space
    const cssW = Math.max(1, Math.round(vw));
    const cssH = Math.max(1, Math.round(vh));
    canvas.width = Math.max(1, Math.floor(vw * dpr));
    canvas.height = Math.max(1, Math.floor(vh * dpr));

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    particleCanvasCssSizeRef.current = { width: cssW, height: cssH };
  }, [viewportSize]);

  // Particle animation loop
  useEffect(() => {
    const canvas = particleCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    if (prefersReducedMotion) return;

    let isMounted = true;
    let lastTs = performance.now();

    const tick = (now: number) => {
      if (!isMounted) return;
      const dt = Math.max(0, (now - lastTs) / 1000);
      lastTs = now;

      const { width, height } = particleCanvasCssSizeRef.current;
      ctx.clearRect(0, 0, width, height);

      const particles = particlesRef.current;

      // Update in-place with compaction, iterate with for-of to satisfy lint rule
      let writeIndex = 0;
      for (const p of particles) {
        // physics
        p.vy += 350 * dt; // softer gravity
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.age += dt;
        if (p.age < p.ttl) {
          particles[writeIndex++] = p;
        }
      }
      particles.length = writeIndex;

      // Draw (small squares, fading out)
      for (const p of particles) {
        const t = Math.min(1, p.age / p.ttl);
        const alpha = 0.7 * (1 - t); // reduce peak opacity
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      // Continue only if there are particles left
      if (particles.length > 0) {
        animationFrameRef.current = requestAnimationFrame(tick);
      } else {
        animationFrameRef.current = null;
      }
    };

    // Provide a starter that can be invoked when new particles spawn
    particleLoopStarterRef.current = () => {
      if (animationFrameRef.current == null && isMounted) {
        lastTs = performance.now();
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    };

    return () => {
      isMounted = false;
      particleLoopStarterRef.current = null;
      if (animationFrameRef.current != null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [prefersReducedMotion]);

  function spawnParticlesAt(
    x: number,
    y: number,
    color: HEX,
    pixelSizeCss: number
  ) {
    if (prefersReducedMotion) return;
    // throttle very fast spawns (e.g., rapid drags)
    const now = performance.now();
    if (now - lastSpawnTimeRef.current < 45) return;
    lastSpawnTimeRef.current = now;

    const count = Math.max(4, Math.min(10, Math.round(pixelSizeCss / 3)));
    const size = 4; // CSS px; DPR handled by canvas transform
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 100; // px/s (slower)
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 50; // gentler upward bias
      particlesRef.current.push({
        x,
        y,
        vx,
        vy,
        age: 0,
        ttl: 0.45 + Math.random() * 0.25, // shorter lifespan
        size,
        color,
      });
    }
    // Cap total particles for perf
    const maxParticles = 400;
    if (particlesRef.current.length > maxParticles) {
      particlesRef.current.splice(
        0,
        particlesRef.current.length - maxParticles
      );
    }
    // Ensure the particle loop is running
    particleLoopStarterRef.current?.();
  }

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      const currentElapsed = Date.now() - startTime;
      setElapsedTime(currentElapsed);
      const remainingTime = time * 1000 - currentElapsed;
      if (remainingTime <= 0) {
        void track('drawing_done_auto');
        onComplete(drawingDataRef.current);
      }
    }, 100);

    return () => {
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTime, time, onComplete, word]);

  const secondsLeft = Math.max(0, Math.round(time - elapsedTime / 1000));

  function handleUndo() {
    void track('click_undo');
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
  }

  function handleFill() {
    void track('click_fill');
    // Snapshot once
    setUndoStack((s) => [
      ...s,
      {
        data: drawingDataRef.current.data,
        colors: [...drawingDataRef.current.colors],
        bg: drawingDataRef.current.bg,
        size: drawingDataRef.current.size,
      },
    ]);
    const total = drawingDataRef.current.size * drawingDataRef.current.size;
    const pixels = Array.from({ length: total }, (_, i) => ({
      index: i,
      color: currentColor,
    }));
    setDrawingData((prev) => DrawingUtils.setPixels(prev, pixels));
  }

  const handleDone = () => {
    void track('click_done_drawing');
    void track('drawing_done_manual');
    onComplete(drawingData);
  };

  const handleOpenColorPicker = () => {
    void track('click_color_picker_plus');
    setIsColorPickerOpen(true);
  };

  const handleCloseColorPicker = () => {
    setIsColorPickerOpen(false);
  };

  const handleSelectExtendedColor = (color: HEX) => {
    void track('select_extended_color');
    setCurrentColor(color);
    setIsColorPickerOpen(false);
    // Dramatic animated MRU update and schedule non-blocking write
    updateRecentWithDrama(color);
  };

  // Render canvas to fill viewport with centered square inside the middle container
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
    {
      const scale = isReviewing ? 0.88 : 1;
      const topScaled = squareY * scale + (1 - scale) * (vh / 2);
      const leftScaled = squareX * scale + (1 - scale) * (vw / 2);
      const sizeScaled = squareSize * scale;
      const root = document.documentElement;
      root.style.setProperty('--draw-top', `${topScaled}px`);
      root.style.setProperty('--draw-left', `${leftScaled}px`);
      root.style.setProperty('--draw-size', `${sizeScaled}px`);
    }

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
        ctx.fillStyle = color;
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
  }, [drawingData, containerSize, viewportSize, isReviewing, layoutVersion]);

  // Keep CSS variables in sync when toggling review mode (scale changes)
  useEffect(() => {
    const { width: vw, height: vh } = viewportSize;
    if (vw <= 0 || vh <= 0) return;
    const { x, y, size } = drawAreaRef.current;
    if (size <= 0) return;
    const scale = isReviewing ? 0.88 : 1;
    const topScaled = y * scale + (1 - scale) * (vh / 2);
    const leftScaled = x * scale + (1 - scale) * (vw / 2);
    const sizeScaled = size * scale;
    const root = document.documentElement;
    root.style.setProperty('--draw-top', `${topScaled}px`);
    root.style.setProperty('--draw-left', `${leftScaled}px`);
    root.style.setProperty('--draw-size', `${sizeScaled}px`);
  }, [isReviewing, viewportSize, layoutVersion]);

  // Cleanup CSS variables on unmount to avoid leaking state across views
  useEffect(() => {
    return () => {
      const root = document.documentElement;
      root.style.removeProperty('--draw-top');
      root.style.removeProperty('--draw-left');
      root.style.removeProperty('--draw-size');
    };
  }, []);

  // When entering review mode, make UI sections inert and ensure focus is not inside them
  useEffect(() => {
    const elements: HTMLElement[] = [];
    if (headerRef.current) elements.push(headerRef.current);
    if (paletteRef.current) elements.push(paletteRef.current);
    for (const el of elements) {
      if (isReviewing) {
        el.setAttribute('inert', '');
      } else {
        el.removeAttribute('inert');
      }
    }
    if (isReviewing) {
      // Ensure any open color picker is closed when transitioning to review
      setIsColorPickerOpen(false);
      const active = document.activeElement as HTMLElement | null;
      if (active) {
        for (const el of elements) {
          if (el.contains(active)) {
            active.blur();
            break;
          }
        }
      }
    }
  }, [isReviewing]);

  // Paint helper applying brush size and symmetry
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

  const handlePixelClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const cssBase = mainCanvasCssSizeRef.current;
      const scaleX = cssBase.width > 0 ? rect.width / cssBase.width : 1;
      const scaleY = cssBase.height > 0 ? rect.height / cssBase.height : 1;
      // Map from transformed client coords to unscaled canvas coords
      const x = (e.clientX - rect.left) / (scaleX || 1);
      const y = (e.clientY - rect.top) / (scaleY || 1);

      const { x: sx, y: sy, size: ss } = drawAreaRef.current;
      if (ss <= 0) return;
      const relX = x - sx;
      const relY = y - sy;
      if (relX < 0 || relY < 0 || relX >= ss || relY >= ss) return;

      const pixelX = Math.min(
        drawingData.size - 1,
        Math.floor((relX / ss) * drawingData.size)
      );
      const pixelY = Math.min(
        drawingData.size - 1,
        Math.floor((relY / ss) * drawingData.size)
      );

      const index = pixelY * drawingData.size + pixelX;
      // Particle burst (only when entering a new pixel index)
      if (index !== lastPaintedIndexRef.current) {
        const { x: sx, y: sy, size: ss } = drawAreaRef.current;
        const pixelSize = ss / drawingData.size;
        const cx = sx + pixelX * pixelSize + pixelSize / 2;
        const cy = sy + pixelY * pixelSize + pixelSize / 2;
        spawnParticlesAt(cx, cy, currentColor, pixelSize);
        lastPaintedIndexRef.current = index;
      }
      paintAt(pixelX, pixelY, currentColor);

      if (!hasTrackedFirstPixel.current) {
        void track('first_pixel_drawn');
        void track('drawing_first_pixel');
        hasTrackedFirstPixel.current = true;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentColor, paintAt]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      setIsDrawing(true);
      if (!hasPushedUndoForStrokeRef.current) {
        hasPushedUndoForStrokeRef.current = true;
        setUndoStack((s) => [
          ...s,
          {
            data: drawingDataRef.current.data,
            colors: [...drawingDataRef.current.colors],
            bg: drawingDataRef.current.bg,
            size: drawingDataRef.current.size,
          },
        ]);
      }
      handlePixelClick(e);
    },
    [handlePixelClick]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      handlePixelClick(e);
    },
    [isDrawing, handlePixelClick]
  );

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
    lastPaintedIndexRef.current = null;
    hasPushedUndoForStrokeRef.current = false;
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      setIsDrawing(true);
      if (!hasPushedUndoForStrokeRef.current) {
        hasPushedUndoForStrokeRef.current = true;
        setUndoStack((s) => [
          ...s,
          {
            data: drawingDataRef.current.data,
            colors: [...drawingDataRef.current.colors],
            bg: drawingDataRef.current.bg,
            size: drawingDataRef.current.size,
          },
        ]);
      }
      const touch = e.touches[0];
      if (touch) {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const cssBase = mainCanvasCssSizeRef.current;
        const scaleX = cssBase.width > 0 ? rect.width / cssBase.width : 1;
        const scaleY = cssBase.height > 0 ? rect.height / cssBase.height : 1;
        const x = (touch.clientX - rect.left) / (scaleX || 1);
        const y = (touch.clientY - rect.top) / (scaleY || 1);

        const { x: sx, y: sy, size: ss } = drawAreaRef.current;
        if (ss <= 0) return;
        const relX = x - sx;
        const relY = y - sy;
        if (relX < 0 || relY < 0 || relX >= ss || relY >= ss) return;

        const pixelX = Math.min(
          drawingData.size - 1,
          Math.floor((relX / ss) * drawingData.size)
        );
        const pixelY = Math.min(
          drawingData.size - 1,
          Math.floor((relY / ss) * drawingData.size)
        );
        const index = pixelY * drawingData.size + pixelX;
        // Particle burst on touch start
        {
          const pixelSize = ss / drawingData.size;
          const cx = sx + pixelX * pixelSize + pixelSize / 2;
          const cy = sy + pixelY * pixelSize + pixelSize / 2;
          spawnParticlesAt(cx, cy, currentColor, pixelSize);
          lastPaintedIndexRef.current = index;
        }
        paintAt(pixelX, pixelY, currentColor);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentColor, paintAt]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      e.preventDefault();
      const touch = e.touches[0];
      if (touch) {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const cssBase = mainCanvasCssSizeRef.current;
        const scaleX = cssBase.width > 0 ? rect.width / cssBase.width : 1;
        const scaleY = cssBase.height > 0 ? rect.height / cssBase.height : 1;
        const x = (touch.clientX - rect.left) / (scaleX || 1);
        const y = (touch.clientY - rect.top) / (scaleY || 1);

        const { x: sx, y: sy, size: ss } = drawAreaRef.current;
        if (ss <= 0) return;
        const relX = x - sx;
        const relY = y - sy;
        if (relX < 0 || relY < 0 || relX >= ss || relY >= ss) return;

        const pixelX = Math.min(
          drawingData.size - 1,
          Math.floor((relX / ss) * drawingData.size)
        );
        const pixelY = Math.min(
          drawingData.size - 1,
          Math.floor((relY / ss) * drawingData.size)
        );
        const index = pixelY * drawingData.size + pixelX;
        // Only spawn when moving into a new pixel
        if (index !== lastPaintedIndexRef.current) {
          const pixelSize = ss / drawingData.size;
          const cx = sx + pixelX * pixelSize + pixelSize / 2;
          const cy = sy + pixelY * pixelSize + pixelSize / 2;
          spawnParticlesAt(cx, cy, currentColor, pixelSize);
          lastPaintedIndexRef.current = index;
        }
        paintAt(pixelX, pixelY, currentColor);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDrawing, currentColor, paintAt]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      setIsDrawing(false);
      lastPaintedIndexRef.current = null;
      hasPushedUndoForStrokeRef.current = false;
    },
    []
  );

  return (
    <main className="absolute inset-0 flex flex-col items-center justify-center p-6 gap-6">
      {/* Scaled wrapper so both canvases share the exact same transform */}
      <div
        className={`fixed inset-0 z-10 transform-gpu origin-center transition-all duration-600 ease-[cubic-bezier(.22,1,.36,1)] ${
          isReviewing
            ? 'scale-[0.88] opacity-100'
            : hasEntered
              ? 'scale-100 opacity-100'
              : 'scale-[0.8] opacity-0'
        }`}
      >
        {/* Fullscreen canvas layer behind UI */}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 z-10 ${
            isReviewing ? 'pointer-events-none' : 'cursor-crosshair'
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />

        {/* Particle canvas overlay (does not block input) */}
        <canvas
          ref={particleCanvasRef}
          className="absolute inset-0 z-20 pointer-events-none"
        />
      </div>

      {/* Tools Toolbar removed here; moved to bottom footer below palette */}

      {/* Header */}
      <header
        className={`relative z-20 flex flex-row items-center justify-center h-min w-full gap-3 transition-all duration-300 ease-out delay-100 ${
          isReviewing
            ? '-translate-y-4 opacity-0'
            : hasEntered
              ? 'translate-y-0 opacity-100'
              : '-translate-y-2 opacity-0'
        }`}
        ref={headerRef}
      >
        <div className="flex flex-col items-start justify-center gap-1 w-full h-full flex-1">
          <Text scale={2.5}>{word}</Text>
          <div className="flex flex-row items-center gap-2 text-secondary">
            <Icon type="clock" />
            <Text scale={2}>{`${secondsLeft}s left`}</Text>
          </div>
        </div>

        <Button onClick={handleDone} size="medium">
          DONE
        </Button>
      </header>

      {/* Middle overlay area used for sizing/centering the drawing square */}
      <div
        ref={containerRef}
        className="relative z-30 flex-1 flex items-center justify-center pointer-events-none"
      >
        {DrawingUtils.isEmpty(drawingData) && (
          <div
            className="fixed z-30 pointer-events-none"
            style={{
              top: 'calc(var(--draw-top) + var(--draw-size) / 2)',
              left: 'calc(var(--draw-left) + var(--draw-size) / 2)',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <Text
              scale={2}
              className={`text-tertiary transition-opacity duration-300 ease-out delay-150 ${
                isReviewing
                  ? 'opacity-0'
                  : hasEntered
                    ? 'opacity-100'
                    : 'opacity-0'
              }`}
            >
              Tap to draw
            </Text>
          </div>
        )}
      </div>

      {/* Palette + Tools Footer (bottom of screen) */}
      <div
        className={`fixed bottom-6 left-0 right-0 z-20 flex flex-col items-center gap-2 transition-all duration-300 ease-out delay-150 ${
          isReviewing
            ? '-translate-y-4 opacity-0'
            : hasEntered
              ? 'translate-y-0 opacity-100'
              : 'translate-y-2 opacity-0'
        }`}
        ref={paletteRef}
      >
        {/* Color Palette */}
        <div
          className="flex flex-row gap-2 items-center justify-center"
          data-mru-row
        >
          {recentColors
            .filter((color) => allowedColorsSet.has(color))
            .map((color, idx) => (
              <ColorSwatch
                key={color}
                dataAttrKey={color}
                onSelect={() => {
                  void track('click_color_swatch');
                  setCurrentColor(color);
                  // Dramatic animated MRU update and schedule non-blocking write
                  updateRecentWithDrama(color);
                }}
                color={color}
                isSelected={
                  idx === 0 && currentColor === color && !isMRUAnimating
                }
              />
            ))}
          <ColorPickerPlusButton onClick={handleOpenColorPicker} />
        </div>
        {/* Tools Toolbar (single row) */}
        <div className="flex flex-row flex-nowrap gap-2 items-center justify-center overflow-x-auto px-3">
          <button
            aria-label="Undo"
            disabled={isReviewing || undoStack.length === 0}
            onClick={handleUndo}
            className={`px-3 h-8 border-4 border-black cursor-pointer transition-all flex items-center justify-center hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] shadow-pixel hover:shadow-pixel-sm active:shadow-none bg-gray-200 ${
              isReviewing || undoStack.length === 0
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            Undo
          </button>
          <button
            aria-label="Fill"
            disabled={isReviewing}
            onClick={handleFill}
            className={`px-3 h-8 border-4 border-black cursor-pointer transition-all flex items-center justify-center hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] shadow-pixel hover:shadow-pixel-sm active:shadow-none bg-gray-200 ${
              isReviewing ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            Fill
          </button>
          {/* Brush sizes */}
          <div className="flex items-center gap-1 ml-2">
            <button
              aria-label="Brush Small"
              aria-pressed={brushSize === 1}
              disabled={isReviewing}
              onClick={() => {
                void track('toggle_brush_size');
                setBrushSize(1);
              }}
              className={`w-8 h-8 border-4 border-black transition-all flex items-center justify-center shadow-pixel hover:shadow-pixel-sm active:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] ${
                brushSize === 1 ? 'bg-black text-white' : 'bg-white'
              } ${isReviewing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              S
            </button>
            <button
              aria-label="Brush Medium"
              aria-pressed={brushSize === 3}
              disabled={isReviewing}
              onClick={() => {
                void track('toggle_brush_size');
                setBrushSize(3);
              }}
              className={`w-8 h-8 border-4 border-black transition-all flex items-center justify-center shadow-pixel hover:shadow-pixel-sm active:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] ${
                brushSize === 3 ? 'bg-black text-white' : 'bg-white'
              } ${isReviewing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              M
            </button>
            <button
              aria-label="Brush Large"
              aria-pressed={brushSize === 5}
              disabled={isReviewing}
              onClick={() => {
                void track('toggle_brush_size');
                setBrushSize(5);
              }}
              className={`w-8 h-8 border-4 border-black transition-all flex items-center justify-center shadow-pixel hover:shadow-pixel-sm active:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] ${
                brushSize === 5 ? 'bg-black text-white' : 'bg-white'
              } ${isReviewing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              L
            </button>
          </div>
          {/* Symmetry toggles */}
          <div className="flex items-center gap-1 ml-2">
            <button
              aria-label="Mirror Vertical"
              aria-pressed={mirrorV}
              disabled={isReviewing}
              onClick={() => {
                void track('toggle_mirror_v');
                setMirrorV((v) => !v);
              }}
              className={`w-10 h-8 border-4 border-black transition-all flex items-center justify-center shadow-pixel hover:shadow-pixel-sm active:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] ${
                mirrorV ? 'bg-black text-white' : 'bg-white'
              } ${isReviewing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              ↔
            </button>
            <button
              aria-label="Mirror Horizontal"
              aria-pressed={mirrorH}
              disabled={isReviewing}
              onClick={() => {
                void track('toggle_mirror_h');
                setMirrorH((v) => !v);
              }}
              className={`w-10 h-8 border-4 border-black transition-all flex items-center justify-center shadow-pixel hover:shadow-pixel-sm active:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] ${
                mirrorH ? 'bg-black text-white' : 'bg-white'
              } ${isReviewing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              ↕
            </button>
          </div>
        </div>
      </div>

      {/* Color Picker Modal */}
      <ColorPickerModal
        isOpen={isColorPickerOpen}
        onClose={handleCloseColorPicker}
        onSelectColor={handleSelectExtendedColor}
        currentColor={currentColor}
        userLevel={userLevel}
      />
    </main>
  );
}

// (moved into component scope above)
