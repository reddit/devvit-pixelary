import { render, screen, fireEvent, cleanup } from '@testing-library/preact';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastProvider, useToast } from './ToastManager';

// Mock components
const TestComponent = () => {
  const { showToast } = useToast();

  return (
    <button onClick={() => showToast({ message: 'Test toast' })}>
      Show Toast
    </button>
  );
};

describe('Toast System', () => {
  beforeEach(() => {
    // Ensure portal root exists before any tests
    let portalRoot = document.getElementById('portal-root');
    if (!portalRoot) {
      portalRoot = document.createElement('div');
      portalRoot.setAttribute('id', 'portal-root');
      document.body.appendChild(portalRoot);
    }
  });

  afterEach(() => {
    // Clean up DOM completely
    cleanup();

    // Clear portal root content safely
    const portalRoot = document.getElementById('portal-root');
    if (portalRoot) {
      portalRoot.innerHTML = '';
    }
  });

  it('should render ToastProvider without errors', () => {
    render(
      <ToastProvider>
        <div>Test Content</div>
      </ToastProvider>
    );

    expect(screen.getByText('Test Content')).toBeTruthy();
  });

  it('should throw error when useToast is used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useToast must be used within a ToastProvider');

    consoleSpy.mockRestore();
  });

  it('should create toast when button is clicked', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const button = screen.getByText('Show Toast');
    fireEvent.click(button);

    // Check if portal root has content (toast was created)
    const portalRoot = document.getElementById('portal-root');
    expect(portalRoot?.children.length).toBeGreaterThan(0);
  });

  it('should have proper ARIA attributes on toast', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const button = screen.getByText('Show Toast');
    fireEvent.click(button);

    // Check if portal root has content with proper attributes
    const portalRoot = document.getElementById('portal-root');
    const toast = portalRoot?.querySelector('[role="alert"]');
    expect(toast).toBeTruthy();
    expect(toast?.getAttribute('aria-live')).toBe('polite');
    expect(toast?.getAttribute('aria-label')).toBeTruthy();
    expect(toast?.getAttribute('tabIndex')).toBe('0');
  });
});
