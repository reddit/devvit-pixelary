import { render, screen, fireEvent } from '@testing-library/preact';
import { describe, it, expect, beforeAll } from 'vitest';
import { DrawStep } from './DrawStep';
import { vi } from 'vitest';

vi.mock('@client/hooks/useTelemetry', () => ({
  useTelemetry: () => ({
    track: async () => ({ ok: true }),
  }),
}));
import { DrawingUtils } from '@shared/schema/drawing';

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

describe('DrawStep reviewing state', () => {
  it('disables input and scales canvas during review', () => {
    const { container } = render(
      <DrawStep
        word="test"
        time={60}
        onComplete={() => {
          return;
        }}
        slateId={null}
        trackSlateAction={async () => {
          return;
        }}
        userLevel={1}
        isReviewing={true}
      />
    );

    // Main canvas has z-10
    const mainCanvas = container.querySelector('canvas.z-10');
    expect(mainCanvas).toBeTruthy();
    expect(mainCanvas).toHaveClass('pointer-events-none');
    // Scaled down class applied on the shared transform wrapper
    const scaledWrapper = container.querySelector('div.fixed.inset-0.z-10');
    expect(scaledWrapper).toBeTruthy();
    expect(scaledWrapper?.className ?? '').toMatch(/scale-\[0\.88\]/);
  });
});

describe('DrawStep tools', () => {
  it('Fill hides hint and Undo restores it', () => {
    render(
      <DrawStep
        word="test"
        time={60}
        onComplete={() => {
          return;
        }}
        slateId={null}
        trackSlateAction={async () => {
          return;
        }}
        userLevel={1}
      />
    );

    // Initially hint is visible
    expect(screen.getByText('Tap to draw')).toBeTruthy();

    // Click Fill
    const fillBtn = screen.getByRole('button', { name: /fill/i });
    fireEvent.click(fillBtn);

    // Hint should be gone
    expect(screen.queryByText('Tap to draw')).toBeNull();

    // Click Undo
    const undoBtn = screen.getByRole('button', { name: /undo/i });
    fireEvent.click(undoBtn);

    // Hint should be back
    expect(screen.getByText('Tap to draw')).toBeTruthy();
  });

  it('Brush size buttons toggle pressed state', () => {
    render(
      <DrawStep
        word="test"
        time={60}
        onComplete={() => {
          return;
        }}
        slateId={null}
        trackSlateAction={async () => {
          return;
        }}
        userLevel={1}
      />
    );

    const small = screen.getByRole('button', { name: /brush small/i });
    const medium = screen.getByRole('button', { name: /brush medium/i });
    const large = screen.getByRole('button', { name: /brush large/i });

    // Default is small pressed
    expect(small).toHaveAttribute('aria-pressed', 'true');
    expect(medium).toHaveAttribute('aria-pressed', 'false');
    expect(large).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(medium);
    expect(small).toHaveAttribute('aria-pressed', 'false');
    expect(medium).toHaveAttribute('aria-pressed', 'true');
    expect(large).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(large);
    expect(small).toHaveAttribute('aria-pressed', 'false');
    expect(medium).toHaveAttribute('aria-pressed', 'false');
    expect(large).toHaveAttribute('aria-pressed', 'true');
  });

  it('Symmetry toggles can be toggled', () => {
    render(
      <DrawStep
        word="test"
        time={60}
        onComplete={() => {
          return;
        }}
        slateId={null}
        trackSlateAction={async () => {
          return;
        }}
        userLevel={1}
      />
    );

    const mirrorV = screen.getByRole('button', { name: /mirror vertical/i });
    const mirrorH = screen.getByRole('button', { name: /mirror horizontal/i });

    expect(mirrorV).toHaveAttribute('aria-pressed', 'false');
    expect(mirrorH).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(mirrorV);
    fireEvent.click(mirrorH);

    expect(mirrorV).toHaveAttribute('aria-pressed', 'true');
    expect(mirrorH).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(mirrorV);
    fireEvent.click(mirrorH);

    expect(mirrorV).toHaveAttribute('aria-pressed', 'false');
    expect(mirrorH).toHaveAttribute('aria-pressed', 'false');
  });
});
