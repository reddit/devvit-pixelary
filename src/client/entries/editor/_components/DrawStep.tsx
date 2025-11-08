import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@components/Button';
import { Icon } from '@components/PixelFont';
import { DRAWING_COLORS, getAvailableExtendedColors } from '@client/constants';
import { Text } from '@components/PixelFont';
import { DrawingUtils, type DrawingData } from '@shared/schema/drawing';
import { getContrastColor } from '@shared/utils/color';
import type { HEX } from '@shared/types';
import { useTelemetry } from '@client/hooks/useTelemetry';
import type { SlateAction } from '@shared/types';
import { Modal } from '@components/Modal';

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

  // Canvas state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentColor, setCurrentColor] = useState<HEX>('#000000');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingData, setDrawingData] = useState<DrawingData>(() =>
    DrawingUtils.createBlank()
  );
  const hasTrackedFirstPixel = useRef(false);
  const drawingDataRef = useRef<DrawingData>(DrawingUtils.createBlank());
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

  const debugLog = (...args: unknown[]) => {
    console.log('[DrawStep]', ...args);
  };

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
  const lastPaintedIndexRef = useRef<number | null>(null);
  const lastSpawnTimeRef = useRef<number>(0);

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

  // Observe container size to size canvas accordingly
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        setContainerSize({ width: cr.width, height: cr.height });
        debugLog('containerSize', { width: cr.width, height: cr.height });
      }
    });
    observer.observe(el);
    // Initialize immediately
    const rect = el.getBoundingClientRect();
    setContainerSize({ width: rect.width, height: rect.height });
    debugLog('containerSize:init', { width: rect.width, height: rect.height });
    return () => {
      observer.disconnect();
    };
  }, []);

  // Track viewport size for full-screen canvas layer
  useEffect(() => {
    const update = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
      debugLog('viewportSize', {
        width: window.innerWidth,
        height: window.innerHeight,
      });
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
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(rect.width));
    const cssH = Math.max(1, Math.round(rect.height));
    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));

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

    let isRunning = true;
    let lastTs = performance.now();

    const tick = (now: number) => {
      if (!isRunning) return;
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

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      isRunning = false;
      if (animationFrameRef.current != null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  function spawnParticlesAt(
    x: number,
    y: number,
    color: HEX,
    pixelSizeCss: number
  ) {
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
    const canvasRectPre = canvas.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(canvasRectPre.width));
    const cssH = Math.max(1, Math.round(canvasRectPre.height));
    // Set backing buffer to device pixels for crispness
    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));

    // Draw in CSS pixel coordinates
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // Clear full canvas in CSS pixels
    ctx.clearRect(0, 0, cssW, cssH);

    // Placement using fixed insets from canvas edges
    const canvasRect = canvas.getBoundingClientRect();
    debugLog('canvasRectAfterStyle', {
      width: canvasRect.width,
      height: canvasRect.height,
    });

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

    debugLog('layout', {
      vw,
      vh,
      dpr,
      canvasRect: {
        left: canvasRect.left,
        top: canvasRect.top,
        width: canvasRect.width,
        height: canvasRect.height,
      },
      canvasBuffer: { width: canvas.width, height: canvas.height },
      canvasCss: { width: cssW, height: cssH },
      insets: { insetX, insetY },
      allowed: {
        left: allowedLeft,
        top: allowedTop,
        width: allowedW,
        height: allowedH,
      },
      s0,
      pxRaw: px,
      gridSize: drawingData.size,
      squareSize,
      square: { x: squareX, y: squareY },
      pixelSize: squareSize / drawingData.size,
    });

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

    // Checkerboard overlay (disabled during review)
    if (!isReviewing) {
      for (let x = 0; x < drawingData.size; x++) {
        for (let y = 0; y < drawingData.size; y++) {
          const isEven = (x + y) % 2 === 0;
          ctx.fillStyle = isEven
            ? 'rgba(255, 255, 255, 0.05)'
            : 'rgba(0, 0, 0, 0.05)';
          ctx.fillRect(
            squareX + x * pixelSize,
            squareY + y * pixelSize,
            pixelSize,
            pixelSize
          );
        }
      }
    }
  }, [drawingData, containerSize, viewportSize, isReviewing]);

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
  }, [isReviewing, viewportSize]);

  const handlePixelClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

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

      debugLog('click', {
        client: { x: e.clientX, y: e.clientY },
        canvasRect: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
        drawArea: drawAreaRef.current,
        rel: { x: relX, y: relY },
        normalized: { x: relX / ss, y: relY / ss },
        pixel: { x: pixelX, y: pixelY },
      });

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
      setDrawingData((prev) =>
        DrawingUtils.setPixel(prev, index, currentColor)
      );

      if (!hasTrackedFirstPixel.current) {
        void track('first_pixel_drawn');
        void track('drawing_first_pixel');
        hasTrackedFirstPixel.current = true;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentColor]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      setIsDrawing(true);
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
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      setIsDrawing(true);
      const touch = e.touches[0];
      if (touch) {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

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
        setDrawingData((prev) =>
          DrawingUtils.setPixel(prev, index, currentColor)
        );

        debugLog('touch-start', {
          client: { x: touch.clientX, y: touch.clientY },
          canvasRect: {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          },
          drawArea: drawAreaRef.current,
          rel: { x: relX, y: relY },
          normalized: { x: relX / ss, y: relY / ss },
          pixel: { x: pixelX, y: pixelY },
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentColor]
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
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

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
        setDrawingData((prev) =>
          DrawingUtils.setPixel(prev, index, currentColor)
        );

        debugLog('touch-move', {
          client: { x: touch.clientX, y: touch.clientY },
          canvasRect: {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          },
          drawArea: drawAreaRef.current,
          rel: { x: relX, y: relY },
          normalized: { x: relX / ss, y: relY / ss },
          pixel: { x: pixelX, y: pixelY },
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDrawing, currentColor]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      setIsDrawing(false);
      lastPaintedIndexRef.current = null;
    },
    []
  );

  return (
    <main className="absolute inset-0 flex flex-col items-center justify-center p-6 gap-6">
      {/* Fullscreen canvas layer behind UI */}
      <canvas
        ref={canvasRef}
        className={`fixed inset-0 z-10 transform-gpu transition-transform duration-600 ease-[cubic-bezier(.22,1,.36,1)] ${
          isReviewing ? 'scale-[0.88] pointer-events-none' : 'scale-100'
        } ${isReviewing ? '' : 'cursor-crosshair'}`}
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
        className={`fixed inset-0 z-15 pointer-events-none transform-gpu transition-transform duration-600 ease-[cubic-bezier(.22,1,.36,1)] ${
          isReviewing ? 'scale-[0.88]' : 'scale-100'
        }`}
      />

      {/* Header */}
      <header
        className={`relative z-20 flex flex-row items-center justify-center h-min w-full gap-3 transition-all duration-300 ease-out ${
          isReviewing ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100'
        }`}
        aria-hidden={isReviewing}
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
        className="relative z-20 flex-1 flex items-center justify-center pointer-events-none"
      >
        {DrawingUtils.isEmpty(drawingData) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Text scale={2} className="text-tertiary">
              Tap to draw
            </Text>
          </div>
        )}
      </div>

      {/* Color Palette */}
      <div
        className={`relative z-20 flex flex-row gap-2 items-center justify-center transition-all duration-300 ease-out ${
          isReviewing ? '-translate-y-4 opacity-0' : 'translate-y-0 opacity-100'
        }`}
        aria-hidden={isReviewing}
      >
        {DRAWING_COLORS.map((color) => (
          <ColorSwatch
            key={color}
            onSelect={() => {
              void track('click_color_swatch');
              setCurrentColor(color);
            }}
            color={color}
            isSelected={currentColor === color}
          />
        ))}
        {userLevel >= 2 && (
          <ColorPickerPlusButton onClick={handleOpenColorPicker} />
        )}
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

type ColorSwatchProps = {
  color: HEX;
  isSelected: boolean;
  onSelect: (color: HEX) => void;
};

function ColorSwatch(props: ColorSwatchProps) {
  const { color, isSelected, onSelect } = props;

  return (
    <button
      onClick={() => {
        onSelect(color);
      }}
      className="w-8 h-8 border-4 border-black cursor-pointer transition-all flex items-center justify-center hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] shadow-pixel hover:shadow-pixel-sm active:shadow-none"
      style={{ backgroundColor: color }}
    >
      <Icon
        type="checkmark"
        scale={2}
        color={getContrastColor(color)}
        className={`transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}
      />
    </button>
  );
}

type ColorPickerPlusButtonProps = {
  onClick: () => void;
};

function ColorPickerPlusButton(props: ColorPickerPlusButtonProps) {
  const { onClick } = props;

  return (
    <button
      onClick={onClick}
      className="w-8 h-8 border-4 border-black cursor-pointer transition-all flex items-center justify-center hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] shadow-pixel hover:shadow-pixel-sm active:shadow-none bg-gray-200"
    >
      <Icon type="plus" scale={2} color="currentColor" />
    </button>
  );
}

type ColorPickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectColor: (color: HEX) => void;
  currentColor: HEX;
  userLevel: number;
};

function ColorPickerModal(props: ColorPickerModalProps) {
  const { isOpen, onClose, onSelectColor, currentColor, userLevel } = props;
  const availableColors = getAvailableExtendedColors(userLevel);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select a color">
      <div className="grid grid-cols-7 gap-2">
        {availableColors.map((color) => (
          <ColorSwatch
            key={color}
            color={color}
            isSelected={currentColor === color}
            onSelect={onSelectColor}
          />
        ))}
      </div>
    </Modal>
  );
}
