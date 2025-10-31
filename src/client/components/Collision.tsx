import { useEffect, useRef, useState } from 'react';

interface CollisionProps {
  count?: number; // Number of particles to spawn (default: 75)
  spawnHeight?: { min: number; max: number }; // Vertical line spawn range
  explosionSpeed?: number; // Base explosion speed (default: 200)
  duration?: number; // Animation duration in ms (default: 1500)
}

interface CollisionParticle {
  x: number;
  y: number;
  vx: number; // horizontal velocity
  vy: number; // vertical velocity
  color: string;
  width: number;
  height: number;
  life: number; // 0-1 life value
}

const CONFETTI_COLORS = [
  '#eb5757', // red
  '#f2994a', // orange
  '#f2c94c', // yellow
  '#27ae60', // green
  '#2f80ed', // blue
  '#9b51e0', // purple
];

export function Collision({
  count = 40,
  spawnHeight = { min: 0.3, max: 0.7 },
  explosionSpeed = 400,
  duration = 1500,
}: CollisionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const [particles, setParticles] = useState<CollisionParticle[]>([]);
  const lastFrameTime = useRef<number>(0);
  const isAnimatingRef = useRef(false);
  const startTimeRef = useRef<number>(0);

  // Spawn particles on mount
  useEffect(() => {
    startTimeRef.current = performance.now();

    // Spawn all particles instantly in a vertical line at center
    const centerX = window.innerWidth / 2;
    const minY = window.innerHeight * spawnHeight.min;
    const maxY = window.innerHeight * spawnHeight.max;

    const initialParticles: CollisionParticle[] = [];
    for (let i = 0; i < count; i++) {
      const colorIndex = Math.floor(Math.random() * CONFETTI_COLORS.length);

      // Spawn along vertical line
      const y = minY + (maxY - minY) * (i / count);

      // Calculate explosion direction and speed (radial outward)
      const angle = Math.random() * Math.PI * 2; // 360 degrees
      const speed = explosionSpeed * (0.5 + Math.random() * 0.5); // 50% to 100% of explosion speed

      initialParticles.push({
        x: centerX,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: CONFETTI_COLORS[colorIndex]!,
        width: 8,
        height: 24,
        life: 1.0,
      });
    }

    setParticles(initialParticles);
    lastFrameTime.current = performance.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === 'undefined') return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match viewport
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }, []);

  // Start animation when particles are set
  useEffect(() => {
    if (particles.length > 0 && !isAnimatingRef.current) {
      isAnimatingRef.current = true;

      const animate = (currentTime: number) => {
        // Check duration timeout
        if (currentTime - startTimeRef.current > duration) {
          isAnimatingRef.current = false;
          animationRef.current = undefined;
          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
            }
          }
          return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');

        setParticles((prevParticles) => {
          const deltaTime = lastFrameTime.current
            ? (currentTime - lastFrameTime.current) / 1000
            : 0.016;
          lastFrameTime.current = currentTime;

          const updatedParticles = prevParticles
            .map((particle) => {
              // Apply initial velocity (explosion)
              particle.x += particle.vx * deltaTime;
              particle.y += particle.vy * deltaTime;

              // Add gravity after initial burst
              particle.vy += 1500 * deltaTime; // gravity

              // Fade out over time
              particle.life = Math.max(0, particle.life - 0.003 * deltaTime);

              return particle;
            })
            .filter((particle) => {
              return (
                particle.y < window.innerHeight + 50 &&
                particle.x > -50 &&
                particle.x < window.innerWidth + 50 &&
                particle.life > 0
              );
            });

          // Render particles
          if (ctx && canvas && updatedParticles.length > 0) {
            // Clear canvas
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

            // Render each particle
            updatedParticles.forEach((particle) => {
              ctx.save();
              ctx.translate(particle.x, particle.y);
              ctx.globalAlpha = particle.life;
              ctx.fillStyle = particle.color;
              ctx.fillRect(
                -particle.width / 2,
                -particle.height / 2,
                particle.width,
                particle.height
              );
              ctx.restore();
            });
          }

          // Continue animation if particles remain
          if (updatedParticles.length > 0) {
            animationRef.current = requestAnimationFrame(animate);
          } else {
            // Clear canvas when animation completes
            if (ctx && canvas) {
              ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
            }
            isAnimatingRef.current = false;
            animationRef.current = undefined;
          }

          return updatedParticles;
        });
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        isAnimatingRef.current = false;
      };
    }
  }, [particles.length, duration]);

  // Handle window resize
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      isAnimatingRef.current = false;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-40"
      data-testid="collision-canvas"
      style={{
        imageRendering: 'pixelated',
        width: '100vw',
        height: '100vh',
      }}
    />
  );
}
