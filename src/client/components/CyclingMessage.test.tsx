import { render, screen, act } from '@testing-library/preact';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CyclingMessage } from './CyclingMessage';

// Mock timers for testing intervals
vi.useFakeTimers();

describe('CyclingMessage', () => {
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

  it('renders the first message initially', () => {
    const messages = ['First message', 'Second message'];

    void act(() => {
      render(<CyclingMessage messages={messages} />);
      // Flush any immediate timers
      vi.runOnlyPendingTimers();
    });

    // Check that the component renders and has the correct aria-label
    expect(screen.getByLabelText('Cycling message')).toBeInTheDocument();
  });

  it('cycles through messages after interval', () => {
    const messages = ['First message', 'Second message', 'Third message'];

    void act(() => {
      render(<CyclingMessage messages={messages} intervalMs={3000} />);
      // Flush any immediate timers
      vi.runOnlyPendingTimers();
    });

    // Initially shows first message
    expect(screen.getByLabelText('Cycling message')).toBeInTheDocument();

    // Fast forward time to trigger cycle
    void act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Should show second message after animation
    void act(() => {
      vi.advanceTimersByTime(300);
    });

    // Component should still be rendered
    expect(screen.getByLabelText('Cycling message')).toBeInTheDocument();
  });

  it('cycles back to first message after last message', () => {
    const messages = ['First', 'Second'];

    void act(() => {
      render(<CyclingMessage messages={messages} intervalMs={3000} />);
      // Flush any immediate timers
      vi.runOnlyPendingTimers();
    });

    // Cycle through all messages
    void act(() => {
      vi.advanceTimersByTime(3000);
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByLabelText('Cycling message')).toBeInTheDocument();

    // Cycle back to first
    void act(() => {
      vi.advanceTimersByTime(3000);
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByLabelText('Cycling message')).toBeInTheDocument();
  });

  it('handles single message without cycling', () => {
    const messages = ['Only message'];

    void act(() => {
      render(<CyclingMessage messages={messages} />);
      // Flush any immediate timers
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByLabelText('Cycling message')).toBeInTheDocument();

    // Fast forward time - should still show same message
    void act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(screen.getByLabelText('Cycling message')).toBeInTheDocument();
  });

  it('handles empty messages array', () => {
    let container: HTMLElement;

    void act(() => {
      const result = render(<CyclingMessage messages={[]} />);
      container = result.container;
      // Flush any immediate timers
      vi.runOnlyPendingTimers();
    });

    expect(container.firstChild).toBeNull();
  });

  it('applies custom className', () => {
    const messages = ['Test message'];
    let container: HTMLElement;

    void act(() => {
      const result = render(
        <CyclingMessage messages={messages} className="custom-class" />
      );
      container = result.container;
      // Flush any immediate timers
      vi.runOnlyPendingTimers();
    });

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('uses custom interval duration', () => {
    const messages = ['First', 'Second'];

    void act(() => {
      render(<CyclingMessage messages={messages} intervalMs={1000} />);
      // Flush any immediate timers
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByLabelText('Cycling message')).toBeInTheDocument();

    // Should cycle after 1 second instead of default 3 seconds
    void act(() => {
      vi.advanceTimersByTime(1000);
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByLabelText('Cycling message')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    const messages = ['Accessible message'];

    void act(() => {
      render(<CyclingMessage messages={messages} />);
      // Flush any immediate timers
      vi.runOnlyPendingTimers();
    });

    const container = screen.getByLabelText('Cycling message');
    expect(container).toHaveAttribute('aria-live', 'polite');
  });
});
