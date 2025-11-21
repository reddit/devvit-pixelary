import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, cleanup, within } from '@testing-library/preact';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import * as DevvitClient from '@devvit/web/client';

vi.mock('@client/hooks/useTelemetry', () => ({
  useTelemetry: () => ({
    track: vi.fn(async () => ({ ok: true })),
  }),
}));

describe('DeleteConfirmationModal', () => {
  const getPortalRoot = (): HTMLElement => {
    const el = document.getElementById('portal-root');
    if (!el) throw new Error('portal-root not found');
    return el;
  };

  beforeEach(() => {
    cleanup();
    // Ensure portal root exists for Modal portal rendering
    let portalRoot = document.getElementById('portal-root');
    if (!portalRoot) {
      portalRoot = document.createElement('div');
      portalRoot.setAttribute('id', 'portal-root');
      document.body.appendChild(portalRoot);
    }
    // Provide a mock for exitExpandedMode on the already-mocked module
    (
      DevvitClient as unknown as {
        exitExpandedMode?: (e: unknown) => Promise<void>;
      }
    ).exitExpandedMode = vi.fn(async () => {});
  });

  it('renders with title and body when open', () => {
    render(<DeleteConfirmationModal isOpen={true} onClose={() => {}} />);
    const portalRoot = getPortalRoot();
    // Assert there is some text content in the modal (not specific copy)
    expect(within(portalRoot).queryAllByText(/\S/).length).toBeGreaterThan(0);
    // Assert there are two action buttons
    expect(within(portalRoot).getAllByRole('button').length).toBe(2);
  });

  it('invokes exitExpandedMode on Delete click', async () => {
    const exitExpandedModeMock = vi.fn(async () => {});
    (
      DevvitClient as unknown as {
        exitExpandedMode?: (e: unknown) => Promise<void>;
      }
    ).exitExpandedMode = exitExpandedModeMock;

    render(<DeleteConfirmationModal isOpen={true} onClose={() => {}} />);
    const portalRoot = getPortalRoot();
    const buttons = within(portalRoot).getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    const deleteButton = buttons[0];
    if (!deleteButton) throw new Error('Delete button not found');
    fireEvent.click(deleteButton);
    expect(exitExpandedModeMock).toHaveBeenCalledTimes(1);
  });

  it('invokes onClose on Cancel click', () => {
    const onClose = vi.fn();
    render(<DeleteConfirmationModal isOpen={true} onClose={onClose} />);
    const portalRoot = getPortalRoot();
    const buttons = within(portalRoot).getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    const cancelButton = buttons[1];
    if (!cancelButton) throw new Error('Cancel button not found');
    fireEvent.click(cancelButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
