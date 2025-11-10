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
});
