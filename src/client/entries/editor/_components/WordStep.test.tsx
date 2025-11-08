import { render, screen, fireEvent, act } from '@testing-library/preact';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WordStep } from './WordStep';
vi.mock('@client/hooks/useTelemetry', () => ({
  useTelemetry: () => ({
    track: async () => ({ ok: true }),
  }),
}));

vi.useFakeTimers();

describe('WordStep transitions', () => {
  beforeEach(() => {
    vi.clearAllTimers();
  });

  afterEach(() => {
    void act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    vi.useFakeTimers();
  });

  it('delays selection to allow exit animation', async () => {
    const selectCandidate = vi.fn();
    const words = ['alpha', 'beta', 'gamma'];

    render(
      <WordStep
        selectCandidate={selectCandidate}
        slateId={'slate-1'}
        words={words}
        isLoading={false}
        refreshCandidates={() => {
          return;
        }}
        trackSlateAction={async () => {
          return;
        }}
        userLevel={1}
      />
    );

    const alphaButton = screen.getByRole('button', { name: /alpha/i });

    // Click first word
    fireEvent.click(alphaButton);

    // Should not immediately navigate
    expect(selectCandidate).not.toHaveBeenCalled();

    // Advance less than delay
    void act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(selectCandidate).not.toHaveBeenCalled();

    // Reach the delay threshold
    void act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(selectCandidate).toHaveBeenCalledWith('alpha');
  });
});
