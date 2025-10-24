import { useEffect, useRef, useState } from 'react';

interface ConfettiProps {
  count?: number; // Number of particles to spawn (default: 100)
  speed?: number; // Base falling speed (default: 3)
  delay?: number; // Delay between particle spawns in ms (default: 200)
}

interface ConfettiParticle {
  x: number;
  y: number;
  vy: number;
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

export function Confetti({
  count = 100,
  speed = 3,
  delay = 100,
}: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const [particles, setParticles] = useState<ConfettiParticle[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [spawnedCount, setSpawnedCount] = useState(0);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === 'undefined') return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size with DPI scaling
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.scale(dpr, dpr);
  }, []);

  // Start animation on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsAnimating(true);
    }
  }, []);

  // Animation loop
  useEffect(() => {
    if (!isAnimating) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
      return;
    }

    const animate = () => {
      setParticles((prevParticles) => {
        const currentTime = Date.now();
        let newParticles = [...prevParticles];

        // Spawn new particles gradually (every delay ms, up to count total)
        if (spawnedCount < count && currentTime % delay < 16) {
          const spawnCount = Math.min(1, count - spawnedCount); // Spawn 1 at a time
          const additionalParticles: ConfettiParticle[] = [];

          for (let i = 0; i < spawnCount; i++) {
            const colorIndex = Math.floor(
              Math.random() * CONFETTI_COLORS.length
            );
            additionalParticles.push({
              x: Math.random() * window.innerWidth,
              y: -20, // Start at the top
              vy: Math.random() * speed + speed, // Fall down at random speed (speed to speed*2)
              color: CONFETTI_COLORS[colorIndex]!,
              width: 8,
              height: 24,
              life: 1.0,
            });
          }

          newParticles = [...newParticles, ...additionalParticles];
          setSpawnedCount((prev) => prev + spawnCount);
        }

        const updatedParticles = newParticles
          .map((particle) => {
            particle.y += particle.vy;
            particle.life = Math.max(0, particle.life - 0.002); // Fade out over time

            return particle;
          })
          .filter((particle) => {
            return (
              typeof window !== 'undefined' &&
              particle.y < window.innerHeight + 50 &&
              particle.x > -50 &&
              particle.x < window.innerWidth + 50 &&
              particle.life > 0
            );
          });

        return updatedParticles;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAnimating, spawnedCount, count, speed, delay]);

  // Render particles with 2D canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || particles.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Update canvas size if needed
    const dpr = window.devicePixelRatio || 1;
    const expectedWidth = window.innerWidth * dpr;
    const expectedHeight = window.innerHeight * dpr;

    if (canvas.width !== expectedWidth || canvas.height !== expectedHeight) {
      canvas.width = expectedWidth;
      canvas.height = expectedHeight;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.scale(dpr, dpr);
    }

    // Clear canvas
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Render each particle
    particles.forEach((particle) => {
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
  }, [particles]);

  // Handle window resize
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.scale(dpr, dpr);
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
    };
  }, []);

  if (!isAnimating) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      data-testid="confetti-canvas"
      style={{
        imageRendering: 'pixelated',
      }}
    />
  );
}
