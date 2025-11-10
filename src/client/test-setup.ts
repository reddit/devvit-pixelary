import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/preact';
import '@testing-library/jest-dom';

// Mock TRPC client hooks used by components so tests don't require a Provider
vi.mock('@client/trpc/client', () => ({
  trpc: {
    app: {
      dictionary: {
        getCandidates: {
          useQuery: () => ({
            data: { slateId: null, words: [null, null, null] },
            isLoading: true,
            refetch: vi.fn(),
          }),
        },
      },
      slate: {
        trackAction: {
          useMutation: () => ({ mutateAsync: vi.fn() }),
        },
      },
      rewards: {
        getEffectiveBonuses: {
          useQuery: () => ({ data: undefined, isLoading: false }),
        },
      },
      post: {
        submitDrawing: {
          useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
        },
      },
      tournament: {
        submitDrawing: {
          useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
        },
      },
      user: {
        getLevel: {
          useQuery: () => ({ data: undefined, isLoading: false }),
        },
        getProfile: {
          useQuery: () => ({ data: undefined, isLoading: false }),
        },
        colors: {
          pushRecent: {
            useMutation: () => ({ mutate: vi.fn() }),
          },
          getRecent: {
            useQuery: () => ({
              isSuccess: false,
              isError: false,
              isFetching: false,
              data: undefined,
            }),
          },
        },
      },
    },
  },
}));

// Mock @devvit/web/client
vi.mock('@devvit/web/client', () => ({
  context: {
    postId: 't3_test123',
    postData: {},
    subredditName: 'testsubreddit',
    username: 'testuser',
    userId: 'testuser123',
  },
}));

// Mock canvas API for Canvas component tests
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: vi.fn(() => ({
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Array(4) })),
    putImageData: vi.fn(),
    createImageData: vi.fn(() => ({ data: new Array(4) })),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    fillText: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    transform: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
  })),
});

Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
  value: vi.fn(() => 'data:image/png;base64,test'),
});

Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
  value: vi.fn((callback: (blob: Blob | null) => void) => {
    callback(new Blob());
  }),
});

// Mock ResizeObserver
(globalThis as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = vi
  .fn()
  .mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

// Mock IntersectionObserver
(
  globalThis as { IntersectionObserver: typeof IntersectionObserver }
).IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Stub requestAnimationFrame to avoid tight RAF loops in tests
// Use timer-based fallback to keep animations advancing predictably
if (typeof globalThis.requestAnimationFrame !== 'function') {
  (
    globalThis as unknown as {
      requestAnimationFrame: typeof requestAnimationFrame;
    }
  ).requestAnimationFrame = ((cb: FrameRequestCallback) => {
    const id = setTimeout(() => {
      cb(performance.now());
    }, 16) as unknown as number;
    return id;
  }) as unknown as typeof requestAnimationFrame;
}
if (typeof globalThis.cancelAnimationFrame !== 'function') {
  (
    globalThis as unknown as {
      cancelAnimationFrame: typeof cancelAnimationFrame;
    }
  ).cancelAnimationFrame = ((id: number) => {
    clearTimeout(id as unknown as number);
  }) as unknown as typeof cancelAnimationFrame;
}

// Cleanup after each test
afterEach(() => {
  cleanup();
});
