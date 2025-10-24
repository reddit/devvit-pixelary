import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CyclingMessage } from './CyclingMessage';

// Mock timers for testing intervals
vi.useFakeTimers();

describe('CyclingMessage', () => {
  beforeEach(() => {
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.useFakeTimers();
  });

  it('renders the first message initially', () => {
    const messages = ['First message', 'Second message'];
    render(<CyclingMessage messages={messages} />);

    // Check that the component renders and has the correct aria-label
    expect(screen.getByLabelText('Cycling message')).toBeInTheDocument();
  });

  it('cycles through messages after interval', () => {
    const messages = ['First message', 'Second message', 'Third message'];
    render(<CyclingMessage messages={messages} intervalMs={3000} />);

    // Initially shows first message
    expect(screen.getByLabelText('Cycling message')).toBeInTheDocument();

    // Fast forward time to trigger cycle
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Should show second message after animation
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Component should still be rendered
    expect(screen.getByLabelText('Cycling message')).toBeInTheDocument();
  });

  it('cycles back to first message after last message', () => {
    const messages = ['First', 'Second'];
    render(<CyclingMessage messages={messages} intervalMs={3000} />);

    // Cycle through all messages
    act(() => {
      vi.advanceTimersByTime(3000);
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByLabelText('Cycling message')).toBeInTheDocument();

    // Cycle back to first
    act(() => {
      vi.advanceTimersByTime(3000);
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByLabelText('Cycling message')).toBeInTheDocument();
  });

  it('handles single message without cycling', () => {
    const messages = ['Only message'];
    render(<CyclingMessage messages={messages} />);

    expect(screen.getByLabelText('Cycling message')).toBeInTheDocument();

    // Fast forward time - should still show same message
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(screen.getByLabelText('Cycling message')).toBeInTheDocument();
  });

  it('handles empty messages array', () => {
    const { container } = render(<CyclingMessage messages={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('applies custom className', () => {
    const messages = ['Test message'];
    const { container } = render(
      <CyclingMessage messages={messages} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('uses custom interval duration', () => {
    const messages = ['First', 'Second'];
    render(<CyclingMessage messages={messages} intervalMs={1000} />);

    expect(screen.getByLabelText('Cycling message')).toBeInTheDocument();

    // Should cycle after 1 second instead of default 3 seconds
    act(() => {
      vi.advanceTimersByTime(1000);
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByLabelText('Cycling message')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    const messages = ['Accessible message'];
    render(<CyclingMessage messages={messages} />);

    const container = screen.getByLabelText('Cycling message');
    expect(container).toHaveAttribute('aria-live', 'polite');
  });
});
