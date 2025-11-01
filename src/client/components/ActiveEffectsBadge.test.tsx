import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import {
  ActiveEffectsBadge,
  formatRemaining,
  getIconForEffect,
} from './ActiveEffectsBadge';
import * as ActiveEffectsHook from '@hooks/useActiveEffects';

vi.mock('@hooks/useActiveEffects', () => ({
  useActiveEffects: vi.fn(),
}));

vi.mock('@client/hooks/useTelemetry', () => ({
  useTelemetry: () => ({
    track: vi.fn(async () => ({ ok: true })),
  }),
}));

const mockedUseActiveEffects =
  ActiveEffectsHook.useActiveEffects as unknown as Mock;

describe('ActiveEffectsBadge utilities', () => {
  it('formatRemaining formats hours and minutes', () => {
    // 3h 12m -> short format is just hours
    expect(formatRemaining(3 * 3600 + 12 * 60)).toBe('3h');
  });

  it('formatRemaining formats minutes and seconds', () => {
    expect(formatRemaining(125)).toBe('2m');
    expect(formatRemaining(5)).toBe('5s');
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
    // Ensure portal root exists for Modal
    let portalRoot = document.getElementById('portal-root');
    if (!portalRoot) {
      portalRoot = document.createElement('div');
      portalRoot.setAttribute('id', 'portal-root');
      document.body.appendChild(portalRoot);
    }
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
    expect(timer).toHaveAttribute('aria-label', '2m');
    // Ensure there is an SVG (icon)
    expect(document.querySelector('svg')).not.toBeNull();
  });

  it('opens modal with effect info on click', () => {
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
    const badge = screen.getByTestId('active-effects-badge');
    fireEvent.click(badge);
    // Modal title derives from consumable config label (aria-label on header)
    expect(screen.getByLabelText('2× Score (4h)')).toBeInTheDocument();
    // Modal body includes description (aria-label on description block)
    expect(
      screen.getByLabelText('All points earned are multiplied by 2x while active.')
    ).toBeInTheDocument();
  });
});
