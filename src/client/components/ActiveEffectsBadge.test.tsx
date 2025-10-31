import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  ActiveEffectsBadge,
  formatRemaining,
  getIconForEffect,
} from './ActiveEffectsBadge';
import * as ActiveEffectsHook from '@hooks/useActiveEffects';

vi.mock('@hooks/useActiveEffects', () => ({
  useActiveEffects: vi.fn(),
}));

const mockedUseActiveEffects =
  ActiveEffectsHook.useActiveEffects as unknown as Mock;

describe('ActiveEffectsBadge utilities', () => {
  it('formatRemaining formats hours and minutes', () => {
    // 3h 12m -> 3 * 3600 + 12 * 60 = 11520 seconds
    expect(formatRemaining(11520)).toBe('3h 12m');
  });

  it('formatRemaining formats minutes and seconds', () => {
    expect(formatRemaining(125)).toBe('2m 05s');
  });

  it('getIconForEffect maps kinds correctly', () => {
    expect(getIconForEffect({ kind: 'score_multiplier', multiplier: 2 })).toBe(
      'star'
    );
    expect(
      getIconForEffect({ kind: 'extra_drawing_time', extraSeconds: 30 })
    ).toBe('clock');
  });
});

describe('ActiveEffectsBadge component', () => {
  beforeEach(() => {
    cleanup();
    mockedUseActiveEffects.mockReset();
  });

  it('renders nothing when no current effect', () => {
    mockedUseActiveEffects.mockReturnValue({
      effects: [],
      currentEffect: null,
      secondsRemaining: 0,
    });
    const { container } = render(<ActiveEffectsBadge />);
    expect(container.firstChild).toBeNull();
  });

  it('renders icon and formatted time when effect exists', () => {
    mockedUseActiveEffects.mockReturnValue({
      effects: [
        {
          activationId: 'a',
          itemId: 'score_multiplier_2x_4h',
          effect: { kind: 'score_multiplier', multiplier: 2 },
          expiresAt: Date.now() + 100000,
        },
      ],
      currentEffect: {
        activationId: 'a',
        itemId: 'score_multiplier_2x_4h',
        effect: { kind: 'score_multiplier', multiplier: 2 },
        expiresAt: Date.now() + 125000,
      },
      secondsRemaining: 125,
    });
    render(<ActiveEffectsBadge />);
    const timer = screen.getByTestId('active-effects-timer');
    expect(timer).toHaveAttribute('aria-label', '2m 05s');
    // Ensure there is an SVG (icon)
    expect(document.querySelector('svg')).not.toBeNull();
  });
});
