import { useState, useEffect } from 'react';
import { Text } from './PixelFont';

type CyclingMessageProps = {
  messages: string[];
  intervalMs?: number;
  className?: string;
};

export function CyclingMessage({
  messages,
  intervalMs = 3000,
  className,
}: CyclingMessageProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  useEffect(() => {
    if (messages.length <= 1) return;

    const interval = setInterval(() => {
      setIsAnimating(true);

      // Change content immediately
      // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
      setCurrentIndex((prev) => (prev + 1) % messages.length);
      // Small delay before starting slide up animation
      setTimeout(() => {
        setIsAnimating(false);
      }, 50);
    }, intervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [messages.length, intervalMs]);

  if (messages.length === 0) return null;

  return (
    <div
      className={`relative h-[14px] ${className ?? ''}`}
      aria-live="polite"
      aria-label="Cycling message"
    >
      <div
        className={
          isAnimating
            ? 'opacity-0 translate-y-1/2'
            : 'opacity-100 translate-y-0 transition-all duration-300 ease-in'
        }
      >
        <Text>{messages[currentIndex] ?? ''}</Text>
      </div>
    </div>
  );
}
