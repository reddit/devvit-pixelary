import { render } from '@testing-library/preact';
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
