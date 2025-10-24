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
  delay = 20,
}: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const [particles, setParticles] = useState<ConfettiParticle[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [spawnedCount, setSpawnedCount] = useState(0);
  const lastSpawnTime = useRef<number>(0);
  const lastFrameTime = useRef<number>(0);

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

    const animate = (currentTime: number) => {
      setParticles((prevParticles) => {
        const deltaTime = lastFrameTime.current
          ? (currentTime - lastFrameTime.current) / 1000
          : 0.016;
        lastFrameTime.current = currentTime;
        let newParticles = [...prevParticles];

        // Spawn new particles gradually (every delay ms, up to count total)
        if (
          spawnedCount < count &&
          currentTime - lastSpawnTime.current >= delay
        ) {
          const spawnCount = Math.min(1, count - spawnedCount); // Spawn 1 at a time
          const additionalParticles: ConfettiParticle[] = [];

          for (let i = 0; i < spawnCount; i++) {
            const colorIndex = Math.floor(
              Math.random() * CONFETTI_COLORS.length
            );
            additionalParticles.push({
              x: Math.random() * window.innerWidth,
              y: -20, // Start at the top
              vy: (Math.random() * speed + speed) * 50, // Scale up for delta time (speed to speed*2) * 50
              color: CONFETTI_COLORS[colorIndex]!,
              width: 4,
              height: 12,
              life: 1.0,
            });
          }

          newParticles = [...newParticles, ...additionalParticles];
          setSpawnedCount((prev) => prev + spawnCount);
          lastSpawnTime.current = currentTime;
        }

        const updatedParticles = newParticles
          .map((particle) => {
            particle.y += particle.vy * deltaTime; // Scale by delta time
            particle.life = Math.max(0, particle.life - 0.002 * deltaTime); // Fade out over time

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
        width: '100vw',
        height: '100vh',
      }}
    />
  );
}
