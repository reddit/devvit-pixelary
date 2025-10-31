import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Confetti } from './Confetti';

// Mock requestAnimationFrame with proper cleanup
let rafCallbacks: FrameRequestCallback[] = [];
const mockRAF = vi.fn((callback: FrameRequestCallback) => {
  rafCallbacks.push(callback);
  setTimeout(() => {
    const index = rafCallbacks.indexOf(callback);
    if (index > -1) {
      rafCallbacks.splice(index, 1);
    }
  }, 16);
  return Math.random(); // Return a unique ID
});
const mockCancelRAF = vi.fn((id: number) => {
  // Remove any pending callbacks
  rafCallbacks = [];
});

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', mockRAF);
  vi.stubGlobal('cancelAnimationFrame', mockCancelRAF);

  // Create a more complete window mock
  const mockWindow = {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  vi.stubGlobal('window', mockWindow);

  // Mock canvas getContext method - use 2D context instead of WebGL
  const mock2DContext = {
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    globalAlpha: 1,
    fillStyle: '',
    fillRect: vi.fn(),
  };

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    mock2DContext as CanvasRenderingContext2D
  );
});

afterEach(() => {
  cleanup(); // Clean up React components
  // Clear any pending animation frames
  rafCallbacks = [];
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Confetti', () => {
  it('renders canvas when mounted', async () => {
    const { unmount } = render(<Confetti />);
    const canvas = screen.getByTestId('confetti-canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveClass('absolute', 'inset-0', 'pointer-events-none');

    // Unmount and wait for cleanup
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  it('applies correct styling', () => {
    render(<Confetti />);
    const canvas = screen.getByTestId('confetti-canvas');
    expect(canvas).toHaveStyle({
      imageRendering: 'pixelated',
    });
  });

  it('accepts custom count', () => {
    render(<Confetti count={50} />);
    const canvas = screen.getByTestId('confetti-canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('accepts custom speed', () => {
    render(<Confetti speed={5} />);
    const canvas = screen.getByTestId('confetti-canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('accepts custom delay', () => {
    render(<Confetti delay={200} />);
    const canvas = screen.getByTestId('confetti-canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('uses default props when not provided', () => {
    render(<Confetti />);
    const canvas = screen.getByTestId('confetti-canvas');
    expect(canvas).toBeInTheDocument();
  });
});
