import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { ReviewStep } from './ReviewStep';
import { DrawingUtils } from '@shared/schema/drawing';
import { trpc } from '@client/trpc/client';
import { ToastProvider } from '@components/ToastManager';

vi.mock('@client/hooks/useTelemetry', () => ({
  useTelemetry: () => ({
    track: async () => ({ ok: true }),
  }),
}));

vi.mock('@tanstack/react-query', async (orig) => {
  const actual = await orig();
  return {
    ...(actual as object),
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
      refetchQueries: vi.fn(),
    }),
  };
});

describe('ReviewStep submit flows', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('posts a drawing in post mode', async () => {
    const mutateAsync = vi
      .fn()
      .mockResolvedValue({ success: true, postId: 't3_x' });
    vi.spyOn(trpc.app.post.submitDrawing, 'useMutation').mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof trpc.app.post.submitDrawing.useMutation>);

    render(
      <ToastProvider>
        <ReviewStep
          drawing={DrawingUtils.createBlank()}
          mode="post"
          word="cat"
          dictionary="main"
          slateId={null}
          trackSlateAction={async () => {}}
        />
      </ToastProvider>
    );
    vi.runOnlyPendingTimers();
    const post = screen.getByRole('button', { name: /post/i });
    fireEvent.click(post);
    expect(mutateAsync).toHaveBeenCalled();
  });

  it('comments a drawing in tournament mode', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ success: true });
    vi.spyOn(trpc.app.tournament.submitDrawing, 'useMutation').mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<
      typeof trpc.app.tournament.submitDrawing.useMutation
    >);

    render(
      <ToastProvider>
        <ReviewStep
          drawing={DrawingUtils.createBlank()}
          mode="tournament"
          tournamentPostId="t3_abc"
        />
      </ToastProvider>
    );
    vi.runOnlyPendingTimers();
    const comment = screen.getByRole('button', { name: /comment/i });
    fireEvent.click(comment);
    expect(mutateAsync).toHaveBeenCalled();
  });
});
