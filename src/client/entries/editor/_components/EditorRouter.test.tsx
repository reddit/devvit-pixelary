import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { EditorContextProvider } from '../_context/EditorContext';
import { EditorRouter } from './EditorRouter';
import { trpc } from '@client/trpc/client';

vi.mock('@client/hooks/useTelemetry', () => ({
  useTelemetry: () => ({ track: vi.fn() }),
}));

describe('EditorRouter', () => {
  it('renders word step then draw step after selection', async () => {
    vi.spyOn(trpc.app.dictionary.getCandidates, 'useQuery').mockReturnValue({
      data: { slateId: 'slate_1', words: ['cat', 'dog', 'tree'] },
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<
      typeof trpc.app.dictionary.getCandidates.useQuery
    >);
    vi.spyOn(trpc.app.user.getProfile, 'useQuery').mockReturnValue({
      data: { level: 1 },
      isLoading: false,
    } as unknown as ReturnType<typeof trpc.app.user.getProfile.useQuery>);
    vi.spyOn(trpc.app.rewards.getEffectiveBonuses, 'useQuery').mockReturnValue({
      data: { extraDrawingTimeSeconds: 0 },
      isLoading: false,
    } as unknown as ReturnType<
      typeof trpc.app.rewards.getEffectiveBonuses.useQuery
    >);
    vi.spyOn(trpc.app.slate.trackAction, 'useMutation').mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof trpc.app.slate.trackAction.useMutation>);

    render(
      <EditorContextProvider onClose={() => {}}>
        <EditorRouter />
      </EditorContextProvider>
    );
    // Pick dog
    const dogBtn = await screen.findByRole('button', { name: /dog/i });
    fireEvent.click(dogBtn);
    // Draw canvas appears after transitions
    await screen.findAllByRole('img', {}, { timeout: 1500 }).catch(() => []);
    expect(document.querySelector('canvas.z-10')).toBeTruthy();
  });
});
