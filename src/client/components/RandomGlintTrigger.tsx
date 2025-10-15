import { useEffect, useRef } from 'react';

interface RandomGlintTriggerProps {
  onTriggerGlint: () => void;
}

export function RandomGlintTrigger({
  onTriggerGlint,
}: RandomGlintTriggerProps) {
  const glintIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Initial glint after mount
    const initialDelay = Math.random() * 2000 + 1000; // 1-3 seconds
    const initialTimeout = setTimeout(onTriggerGlint, initialDelay);

    // Random interval glints
    const scheduleNextGlint = () => {
      const nextDelay = Math.random() * 3000 + 4000; // 4-7 seconds
      glintIntervalRef.current = setTimeout(() => {
        onTriggerGlint();
        scheduleNextGlint();
      }, nextDelay);
    };

    scheduleNextGlint();

    return () => {
      clearTimeout(initialTimeout);
      if (glintIntervalRef.current) {
        clearTimeout(glintIntervalRef.current);
      }
    };
  }, [onTriggerGlint]);

  return null; // This component doesn't render anything
}
