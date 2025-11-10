import { useEffect, useRef, useState } from 'react';

type UseTimerParams = {
  durationSeconds: number;
  onExpire: () => void;
  tickMs?: number;
};

export function useTimer(params: UseTimerParams): number {
  const { durationSeconds, onExpire, tickMs = 100 } = params;

  const [elapsedMs, setElapsedMs] = useState(0);
  const startTimeMsRef = useRef<number | null>(null);
  const hasExpiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  // Keep the latest onExpire without restarting the timer
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    startTimeMsRef.current = performance.now();
    setElapsedMs(0);
    hasExpiredRef.current = false;

    const intervalId = setInterval(() => {
      const start = startTimeMsRef.current;
      const now = performance.now();
      if (start == null) return;
      const elapsed = now - start;
      setElapsedMs(elapsed);

      const remaining = durationSeconds * 1000 - elapsed;
      if (!hasExpiredRef.current && remaining <= 0) {
        hasExpiredRef.current = true;
        clearInterval(intervalId);
        // Call the latest onExpire
        onExpireRef.current();
      }
    }, tickMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [durationSeconds, tickMs]);

  const secondsLeft = Math.max(
    0,
    Math.round(durationSeconds - elapsedMs / 1000)
  );
  return secondsLeft;
}
