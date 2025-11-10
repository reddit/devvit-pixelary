import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { DrawingEditor } from './Editor';
import { trpc } from '@client/trpc/client';

vi.mock('@client/hooks/useTelemetry', () => ({
  useTelemetry: () => ({
    track: async () => ({ ok: true }),
  }),
}));

describe('DrawingEditor step transitions', () => {
  beforeAll(() => {
    (
      globalThis as unknown as { ResizeObserver: new () => ResizeObserver }
    ).ResizeObserver = class {
      observe() {
        // no-op
      }
      unobserve() {
        // no-op
      }
      disconnect() {
        // no-op
      }
    } as unknown as new () => ResizeObserver;
  });
  beforeEach(() => {
    vi.useFakeTimers();
    // Provide dictionary slate
    vi.spyOn(trpc.app.dictionary.getCandidates, 'useQuery').mockReturnValue({
      data: { slateId: 'slate_1', words: ['cat', 'dog', 'tree'] },
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<
      typeof trpc.app.dictionary.getCandidates.useQuery
    >);
    // Profile/bonuses
    vi.spyOn(trpc.app.user.getProfile, 'useQuery').mockReturnValue({
      data: { level: 1 },
      isLoading: false,
    } as unknown as ReturnType<typeof trpc.app.user.getProfile.useQuery>);
    vi.spyOn(trpc.app.rewards.getEffectiveBonuses, 'useQuery').mockReturnValue({
      data: { extraDrawingTimeSeconds: 0 },
      isLoading: false,
    } as unknown as ReturnType<
      typeof trpc.app.rewards.getEffectiveBonuses.useQuery
    >);
    // Slate tracking mutation
    vi.spyOn(trpc.app.slate.trackAction, 'useMutation').mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof trpc.app.slate.trackAction.useMutation>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('transitions word -> draw', async () => {
    render(<DrawingEditor onClose={() => {}} />);
    vi.runOnlyPendingTimers();

    // Pick the second word ('dog')
    const dogBtn = screen.getByRole('button', { name: /dog/i });
    fireEvent.click(dogBtn);
    // Advance timers to cover exit animation + transition
    vi.advanceTimersByTime(800);
    await Promise.resolve();

    // Flush a couple of RAF frames
    vi.advanceTimersByTime(32);
    // DrawStep should be visible (main canvas present)
    const queryCanvas = document.querySelector('canvas.z-10');
    expect(queryCanvas).toBeTruthy();
  });
});
