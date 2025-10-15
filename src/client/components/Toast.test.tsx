import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastProvider, useToast, useToastHelpers } from './ToastManager';
import { LevelProgressAttachment } from './LevelProgressAttachment';

// Mock components
const TestComponent = () => {
  const { showToast } = useToast();

  return (
    <button onClick={() => showToast({ message: 'Test toast' })}>
      Show Toast
    </button>
  );
};

const TestHelpersComponent = () => {
  const { success, error, warning, info } = useToastHelpers();

  return (
    <div>
      <button onClick={() => success('Success!')}>Success</button>
      <button onClick={() => error('Error!')}>Error</button>
      <button onClick={() => warning('Warning!')}>Warning</button>
      <button onClick={() => info('Info!')}>Info</button>
    </div>
  );
};

const TestAttachmentComponent = () => {
  const { showToast } = useToast();

  return (
    <button
      onClick={() =>
        showToast({
          message: 'Toast with attachment',
          attachment: (
            <div data-testid="toast-attachment">Attachment content</div>
          ),
        })
      }
    >
      Show Toast with Attachment
    </button>
  );
};

describe('Toast System', () => {
  beforeEach(() => {
    // Mock portal root
    const portalRoot = document.createElement('div');
    portalRoot.setAttribute('id', 'portal-root');
    document.body.appendChild(portalRoot);

    // Mock timers
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Cleanup
    const portalRoot = document.getElementById('portal-root');
    if (portalRoot) {
      document.body.removeChild(portalRoot);
    }

    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('ToastProvider', () => {
    it('should render children without errors', () => {
      render(
        <ToastProvider>
          <div>Test Content</div>
        </ToastProvider>
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should throw error when useToast is used outside provider', () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useToast must be used within a ToastProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('Toast Functionality', () => {
    it('should show and hide toast', async () => {
      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      const button = screen.getByText('Show Toast');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Test toast')).toBeInTheDocument();
      });

      // Fast-forward time to trigger auto-dismiss
      act(() => {
        vi.advanceTimersByTime(4000);
      });

      await waitFor(() => {
        expect(screen.queryByText('Test toast')).not.toBeInTheDocument();
      });
    });

    it('should handle click to dismiss', async () => {
      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      const button = screen.getByText('Show Toast');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Test toast')).toBeInTheDocument();
      });

      const toast = screen.getByText('Test toast');
      fireEvent.click(toast);

      await waitFor(() => {
        expect(screen.queryByText('Test toast')).not.toBeInTheDocument();
      });
    });

    it('should handle keyboard events', async () => {
      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      const button = screen.getByText('Show Toast');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Test toast')).toBeInTheDocument();
      });

      const toast = screen.getByText('Test toast');
      fireEvent.keyDown(toast, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByText('Test toast')).not.toBeInTheDocument();
      });
    });
  });

  describe('Toast Helpers', () => {
    it('should show different toast types', async () => {
      render(
        <ToastProvider>
          <TestHelpersComponent />
        </ToastProvider>
      );

      const successButton = screen.getByText('Success');
      fireEvent.click(successButton);

      await waitFor(() => {
        expect(screen.getByText('Success!')).toBeInTheDocument();
      });

      const errorButton = screen.getByText('Error');
      fireEvent.click(errorButton);

      await waitFor(() => {
        expect(screen.getByText('Error!')).toBeInTheDocument();
      });
    });
  });

  describe('Toast Positioning', () => {
    it('should render toasts in correct positions', async () => {
      const TestPositionComponent = () => {
        const { showToast } = useToast();

        return (
          <div>
            <button
              onClick={() =>
                showToast({ message: 'Top Right', position: 'top-right' })
              }
            >
              Top Right
            </button>
            <button
              onClick={() =>
                showToast({ message: 'Top Left', position: 'top-left' })
              }
            >
              Top Left
            </button>
          </div>
        );
      };

      render(
        <ToastProvider>
          <TestPositionComponent />
        </ToastProvider>
      );

      const topRightButton = screen.getByText('Top Right');
      fireEvent.click(topRightButton);

      await waitFor(() => {
        const toast = screen.getByText('Top Right');
        expect(toast).toHaveClass('top-4', 'right-4');
      });
    });
  });

  describe('Toast Stacking', () => {
    it('should stack multiple toasts properly', async () => {
      const TestStackingComponent = () => {
        const { showToast } = useToast();

        return (
          <button
            onClick={() => {
              showToast({ message: 'Toast 1' });
              setTimeout(() => showToast({ message: 'Toast 2' }), 100);
              setTimeout(() => showToast({ message: 'Toast 3' }), 200);
            }}
          >
            Show Stacked Toasts
          </button>
        );
      };

      render(
        <ToastProvider>
          <TestStackingComponent />
        </ToastProvider>
      );

      const button = screen.getByText('Show Stacked Toasts');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Toast 1')).toBeInTheDocument();
        expect(screen.getByText('Toast 2')).toBeInTheDocument();
        expect(screen.getByText('Toast 3')).toBeInTheDocument();
      });

      // Check that toasts are positioned differently (not overlapping)
      const toast1 = screen.getByText('Toast 1');
      const toast2 = screen.getByText('Toast 2');
      const toast3 = screen.getByText('Toast 3');

      // Each toast should have different top positions
      const style1 = window.getComputedStyle(toast1);
      const style2 = window.getComputedStyle(toast2);
      const style3 = window.getComputedStyle(toast3);

      expect(style1.top).not.toBe(style2.top);
      expect(style2.top).not.toBe(style3.top);
    });
  });

  describe('Toast Limits', () => {
    it('should respect max toast limit', async () => {
      const TestLimitComponent = () => {
        const { showToast } = useToast();

        return (
          <button
            onClick={() => {
              for (let i = 0; i < 10; i++) {
                showToast({ message: `Toast ${i}` });
              }
            }}
          >
            Show Many Toasts
          </button>
        );
      };

      render(
        <ToastProvider maxToasts={3}>
          <TestLimitComponent />
        </ToastProvider>
      );

      const button = screen.getByText('Show Many Toasts');
      fireEvent.click(button);

      await waitFor(() => {
        // Should only show the last 3 toasts
        expect(screen.getByText('Toast 7')).toBeInTheDocument();
        expect(screen.getByText('Toast 8')).toBeInTheDocument();
        expect(screen.getByText('Toast 9')).toBeInTheDocument();
        expect(screen.queryByText('Toast 0')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', async () => {
      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      const button = screen.getByText('Show Toast');
      fireEvent.click(button);

      await waitFor(() => {
        const toast = screen.getByRole('alert');
        expect(toast).toHaveAttribute('aria-live', 'polite');
        expect(toast).toHaveAttribute('aria-label');
        expect(toast).toHaveAttribute('tabIndex', '0');
      });
    });
  });

  describe('Toast Attachments', () => {
    it('should render toast with attachment', async () => {
      render(
        <ToastProvider>
          <TestAttachmentComponent />
        </ToastProvider>
      );

      const button = screen.getByText('Show Toast with Attachment');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Toast with attachment')).toBeInTheDocument();
        expect(screen.getByTestId('toast-attachment')).toBeInTheDocument();
        expect(screen.getByText('Attachment content')).toBeInTheDocument();
      });
    });

    it('should render toast without attachment when not provided', async () => {
      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      const button = screen.getByText('Show Toast');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Test toast')).toBeInTheDocument();
        expect(
          screen.queryByTestId('toast-attachment')
        ).not.toBeInTheDocument();
      });
    });

    it('should render LevelProgressAttachment correctly', async () => {
      const TestLevelProgressComponent = () => {
        const { showToast } = useToast();

        return (
          <button
            onClick={() =>
              showToast({
                message: '+10 points!',
                attachment: (
                  <LevelProgressAttachment newScore={100} earnedPoints={10} />
                ),
              })
            }
          >
            Show Level Progress Toast
          </button>
        );
      };

      render(
        <ToastProvider>
          <TestLevelProgressComponent />
        </ToastProvider>
      );

      const button = screen.getByText('Show Level Progress Toast');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('+10 points!')).toBeInTheDocument();
        expect(screen.getByText('Newcomer')).toBeInTheDocument();
        expect(screen.getByText('+10 points earned')).toBeInTheDocument();
      });
    });
  });
});
