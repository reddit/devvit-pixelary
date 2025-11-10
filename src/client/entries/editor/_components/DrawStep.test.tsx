import { render, screen, fireEvent } from '@testing-library/preact';
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  vi,
} from 'vitest';
import { DrawStep } from './DrawStep';
import { trpc } from '@client/trpc/client';

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

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
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

    vi.runOnlyPendingTimers();

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

    vi.runOnlyPendingTimers();

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

    vi.runOnlyPendingTimers();

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

    vi.runOnlyPendingTimers();

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

  it('Clicking canvas paints at least one pixel (brush 1)', () => {
    const onComplete = vi.fn();
    const { container } = render(
      <DrawStep
        word="test"
        time={60}
        onComplete={onComplete}
        slateId={null}
        trackSlateAction={async () => {
          return;
        }}
        userLevel={1}
      />
    );
    vi.runOnlyPendingTimers();
    const mainCanvas = container.querySelector('canvas.z-10');
    expect(mainCanvas).toBeTruthy();
    if (!mainCanvas) {
      throw new Error('main canvas not found');
    }
    const rect = {
      left: 0,
      top: 0,
      width: 600,
      height: 600,
      right: 600,
      bottom: 600,
    } as DOMRect;
    vi.spyOn(mainCanvas, 'getBoundingClientRect').mockReturnValue(rect);
    fireEvent.mouseDown(mainCanvas, { clientX: 300, clientY: 300 });
    // Complete and inspect drawing
    fireEvent.click(screen.getByRole('button', { name: /done/i }));
    expect(onComplete).toHaveBeenCalled();
    const firstCall = onComplete.mock.calls[0];
    if (!firstCall) {
      throw new Error('onComplete not called');
    }
    const drawing = firstCall[0] as ReturnType<typeof DrawingUtils.createBlank>;
    const colors = DrawingUtils.getAllPixelColors(drawing);
    const bg = drawing.colors[drawing.bg];
    const nonBgCount = colors.filter((c) => c && c !== bg).length;
    expect(nonBgCount).toBeGreaterThanOrEqual(1);
  });

  it('Brush 3 with mirror toggles paints multiple pixels', () => {
    const onComplete = vi.fn();
    const { container } = render(
      <DrawStep
        word="test"
        time={60}
        onComplete={onComplete}
        slateId={null}
        trackSlateAction={async () => {
          return;
        }}
        userLevel={1}
      />
    );
    vi.runOnlyPendingTimers();
    // Enable brush 3 and both mirrors
    fireEvent.click(screen.getByRole('button', { name: /brush medium/i }));
    fireEvent.click(screen.getByRole('button', { name: /mirror vertical/i }));
    fireEvent.click(screen.getByRole('button', { name: /mirror horizontal/i }));
    const mainCanvas = container.querySelector('canvas.z-10');
    expect(mainCanvas).toBeTruthy();
    if (!mainCanvas) {
      throw new Error('main canvas not found');
    }
    const rect = {
      left: 0,
      top: 0,
      width: 600,
      height: 600,
      right: 600,
      bottom: 600,
    } as DOMRect;
    vi.spyOn(mainCanvas, 'getBoundingClientRect').mockReturnValue(rect);
    fireEvent.mouseDown(mainCanvas, { clientX: 300, clientY: 300 });
    // Complete and inspect drawing
    fireEvent.click(screen.getByRole('button', { name: /done/i }));
    expect(onComplete).toHaveBeenCalled();
    const firstCall = onComplete.mock.calls[0];
    if (!firstCall) {
      throw new Error('onComplete not called');
    }
    const drawing = firstCall[0] as ReturnType<typeof DrawingUtils.createBlank>;
    const colors = DrawingUtils.getAllPixelColors(drawing);
    const bg = drawing.colors[drawing.bg];
    const nonBgCount = colors.filter((c) => c && c !== bg).length;
    expect(nonBgCount).toBeGreaterThan(1);
  });

  it('Palette MRU selection calls pushRecent mutate once', () => {
    const mutateSpy = vi.fn();
    // Override only this hook for this test
    vi.spyOn(trpc.app.user.colors.pushRecent, 'useMutation').mockReturnValue({
      mutate: mutateSpy,
    } as unknown as ReturnType<
      typeof trpc.app.user.colors.pushRecent.useMutation
    >);

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
      />
    );
    vi.runOnlyPendingTimers();
    const tiles = container.querySelectorAll('[data-mru-row] [data-color]');
    expect(tiles.length).toBeGreaterThanOrEqual(2);
    // Click the second color tile
    (tiles[1] as HTMLButtonElement).click();
    expect(mutateSpy).toHaveBeenCalledTimes(1);
  });
});
