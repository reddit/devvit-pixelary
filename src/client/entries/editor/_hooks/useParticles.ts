import { useEffect, useMemo, useRef } from 'react';
import type { HEX } from '@shared/types';
import type { Size2D } from './useGeometry';
import type { RefObject } from 'react';

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

type UseParticlesParams = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  viewportSize: Size2D;
};

export function useParticles(params: UseParticlesParams) {
  const { canvasRef, viewportSize } = params;

  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const particleLoopStarterRef = useRef<(() => void) | null>(null);
  const lastSpawnTimeRef = useRef<number>(0);
  const particleCanvasCssSizeRef = useRef<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Size particle canvas to viewport and set crisp transform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width: vw, height: vh } = viewportSize;
    if (vw <= 0 || vh <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${vw}px`;
    canvas.style.height = `${vh}px`;
    const cssW = Math.max(1, Math.round(vw));
    const cssH = Math.max(1, Math.round(vh));
    canvas.width = Math.max(1, Math.floor(vw * dpr));
    canvas.height = Math.max(1, Math.floor(vh * dpr));

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    particleCanvasCssSizeRef.current = { width: cssW, height: cssH };
  }, [viewportSize, canvasRef]);

  // Particle animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
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

      // Update in-place with compaction
      let writeIndex = 0;
      for (const p of particles) {
        p.vy += 350 * dt; // gravity
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.age += dt;
        if (p.age < p.ttl) {
          particles[writeIndex++] = p;
        }
      }
      particles.length = writeIndex;

      // Draw
      for (const p of particles) {
        const t = Math.min(1, p.age / p.ttl);
        const alpha = 0.7 * (1 - t);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      if (particles.length > 0) {
        animationFrameRef.current = requestAnimationFrame(tick);
      } else {
        animationFrameRef.current = null;
      }
    };

    particleLoopStarterRef.current = () => {
      if (animationFrameRef.current == null) {
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
  }, [canvasRef, prefersReducedMotion]);

  const spawnAt = useMemo(() => {
    return (x: number, y: number, color: HEX, pixelSizeCss: number) => {
      if (prefersReducedMotion) return;
      const now = performance.now();
      if (now - lastSpawnTimeRef.current < 45) return;
      lastSpawnTimeRef.current = now;

      const count = Math.max(4, Math.min(10, Math.round(pixelSizeCss / 3)));
      const size = 4;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 100;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed - 50;
        particlesRef.current.push({
          x,
          y,
          vx,
          vy,
          age: 0,
          ttl: 0.45 + Math.random() * 0.25,
          size,
          color,
        });
      }
      const maxParticles = 400;
      if (particlesRef.current.length > maxParticles) {
        particlesRef.current.splice(
          0,
          particlesRef.current.length - maxParticles
        );
      }
      particleLoopStarterRef.current?.();
    };
  }, [prefersReducedMotion]);

  return { spawnAt };
}
