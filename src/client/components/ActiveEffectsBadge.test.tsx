import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ActiveEffectsBadge } from './ActiveEffectsBadge';
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

// utilities are now covered in shared utils tests; this component focuses on rendering

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
    expect(screen.getByLabelText('2x Points Earned!')).toBeInTheDocument();
    // Modal body shows remaining time
    expect(screen.getByLabelText('2m 5s left')).toBeInTheDocument();
  });
});
