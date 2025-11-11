import { useState, useEffect, useRef } from 'react';
import { Button } from '@components/Button';
import { Icon } from '@components/PixelFont';
import { DRAWING_COLORS } from '@client/constants';
import { Text } from '@components/PixelFont';
import { DrawingUtils, type DrawingData } from '@shared/schema/drawing';
import type { HEX } from '@shared/types';
import { useDrawTelemetry } from '../_hooks/useDrawTelemetry';
import { useTimer } from '../_hooks/useTimer';
import type { SlateAction } from '@shared/types';
// import { trpc } from '@client/trpc/client';
import { Palette } from './Palette';
import { Toolbar } from './Toolbar';
import {
  DrawingStateProvider,
  useDrawingState,
} from '../_hooks/useDrawingState';
import { useGeometry } from '..//_hooks/useGeometry';
import { DrawingCanvas } from './DrawingCanvas';
import { ParticleCanvas } from './ParticleCanvas';
import { usePointerPainting } from '../_hooks/usePointerPainting';
import { useParticles } from '../_hooks/useParticles';

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

function DrawStepBody(props: DrawStepProps) {
  const {
    word,
    time,
    onComplete,
    slateId,
    trackSlateAction,
    userLevel,
    isReviewing = false,
  } = props;

  const [hasEntered, setHasEntered] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState(0);

  const { track, trackFirstPixelOnce } = useDrawTelemetry({
    word,
    slateId,
    trackSlateAction,
  });

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
  const [currentColor, setCurrentColor] = useState<HEX>(
    DRAWING_COLORS[0] ?? '#000000'
  );
  // pointer state managed in usePointerPainting
  const {
    drawingData,
    paintAt,
    floodFillAt,
    toolMode,
    pushUndoSnapshot,
    getDrawingData,
  } = useDrawingState();
  const mainCanvasCssSizeRef = useRef<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  // container size no longer needed for rendering
  const { viewportSize, applyDrawAreaCssVariables } = useGeometry();

  // debug logging removed

  // Tools & history state moved into useDrawingState
  // undo snapshot managed in usePointerPainting

  // Geometry of the drawable square inside the canvas (in CSS pixels)
  const drawAreaRef = useRef<{
    x: number;
    y: number;
    size: number;
  }>({ x: 0, y: 0, size: 0 });

  // Particle canvas and state
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);
  // last painted index handled in usePointerPainting
  const checkerboardCacheRef = useRef<Map<number, HTMLCanvasElement>>(
    new Map()
  );
  // particle system
  const { spawnAt: spawnParticles } = useParticles({
    canvasRef: particleCanvasRef,
    viewportSize,
  });

  // palette moved to Palette component

  // container size observer removed

  // viewport size managed by useGeometry

  // drawing data managed by context

  // particle canvas managed by useParticles

  // spawn handled by useParticles hook via spawnParticles

  // Timer effect
  const secondsLeft = useTimer({
    durationSeconds: time,
    onExpire: () => {
      void track('drawing_done_auto');
      onComplete(getDrawingData());
    },
  });

  // actions handled by Toolbar

  const handleDone = () => {
    void track('click_done_drawing');
    void track('drawing_done_manual');
    onComplete(drawingData);
  };

  // color picker handled within Palette component

  // Render canvas to fill viewport with centered square inside the middle container
  // Canvas rendering handled by DrawingCanvas via useRenderer

  // Keep CSS variables in sync when toggling review mode (scale changes)
  useEffect(() => {
    const { x, y, size } = drawAreaRef.current;
    if (size <= 0) return;
    applyDrawAreaCssVariables({ x, y, size }, isReviewing);
  }, [isReviewing, viewportSize, layoutVersion, applyDrawAreaCssVariables]);

  // When entering review mode, make UI sections inert and ensure focus is not inside them
  useEffect(() => {
    const elements: HTMLElement[] = [];
    if (headerRef.current) elements.push(headerRef.current);
    for (const el of elements) {
      if (isReviewing) {
        el.setAttribute('inert', '');
      } else {
        el.removeAttribute('inert');
      }
    }
    if (isReviewing) {
      // Ensure focus is not inside inert sections
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

  // Paint helper moved into useDrawingState
  const pointerHandlers = usePointerPainting({
    canvasRef,
    mainCanvasCssSizeRef,
    drawAreaRef,
    drawingData,
    currentColor,
    paintAt,
    floodFillAt,
    pushUndoSnapshot,
    onFirstPixel: trackFirstPixelOnce,
    spawnAt: spawnParticles,
    toolMode,
  });

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
        <DrawingCanvas
          isReviewing={isReviewing}
          viewportSize={viewportSize}
          layoutVersion={layoutVersion}
          drawingData={drawingData}
          canvasRef={canvasRef}
          drawAreaRef={drawAreaRef}
          mainCanvasCssSizeRef={mainCanvasCssSizeRef}
          checkerboardCacheRef={checkerboardCacheRef}
          applyDrawAreaCssVariables={applyDrawAreaCssVariables}
          onPointerDown={pointerHandlers.onPointerDown}
          onPointerMove={pointerHandlers.onPointerMove}
          onPointerUp={pointerHandlers.onPointerUp}
          onPointerLeave={pointerHandlers.onPointerLeave}
          className={`absolute inset-0 z-10 ${
            isReviewing ? 'pointer-events-none' : 'cursor-crosshair'
          }`}
        />

        {/* Particle canvas overlay (does not block input) */}
        <ParticleCanvas
          canvasRef={particleCanvasRef}
          className="absolute inset-0 z-20 pointer-events-none"
        />
      </div>

      {/* Tools Toolbar removed here; moved to bottom footer below palette */}

      {/* Header */}
      <header
        className={`relative z-20 flex flex-row items-center justify-center h-min w-full gap-3 transition-all duration-300 ease-out ${
          isReviewing ? 'delay-0' : 'delay-100'
        } ${
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
      <div className="fixed bottom-6 left-0 right-0 z-20 flex flex-col items-center gap-2">
        <Palette
          userLevel={userLevel}
          isReviewing={isReviewing}
          hasEntered={hasEntered}
          onColorChange={setCurrentColor}
        />
        <Toolbar isReviewing={isReviewing} hasEntered={hasEntered} />
      </div>

      {/* Color Picker Modal moved into Palette */}
    </main>
  );
}

// (moved into component scope above)

export function DrawStep(props: DrawStepProps) {
  return (
    <DrawingStateProvider>
      <DrawStepBody {...props} />
    </DrawingStateProvider>
  );
}
