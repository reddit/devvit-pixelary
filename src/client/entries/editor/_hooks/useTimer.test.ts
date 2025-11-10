import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/preact';
import { useTimer } from './useTimer';

describe('useTimer', () => {
  it('calls onExpire at zero', async () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    const { result } = renderHook(() =>
      useTimer({ durationSeconds: 1, onExpire, tickMs: 10 })
    );
    expect(result.current).toBe(1);
    vi.advanceTimersByTime(1100);
    expect(onExpire).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('does not reset when re-rendering with new callback identity', async () => {
    vi.useFakeTimers();
    const onExpireSpy = vi.fn();
    const { rerender } = renderHook(() =>
      useTimer({
        durationSeconds: 1,
        // Intentionally wrap to create a new identity on each render
        onExpire: () => onExpireSpy(),
        tickMs: 10,
      })
    );
    // Halfway there
    vi.advanceTimersByTime(600);
    // Trigger a re-render (new onExpire identity)
    rerender();
    // Advance past the 1s mark total; should have expired exactly once
    vi.advanceTimersByTime(600);
    expect(onExpireSpy).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
