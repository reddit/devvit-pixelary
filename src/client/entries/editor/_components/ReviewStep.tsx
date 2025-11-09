import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@components/Button';
import { Modal } from '@components/Modal';
import { trpc } from '@client/trpc/client';
import type { DrawingData } from '@shared/schema/drawing';
import { Text } from '@components/PixelFont';
import { navigateTo, context, exitExpandedMode } from '@devvit/web/client';
import { useTelemetry } from '@client/hooks/useTelemetry';
import type { SlateAction } from '@shared/types';

type BaseReviewProps = {
  drawing: DrawingData;
  onCancel: () => void;
  onSuccess?: (result?: {
    success: boolean;
    postId?: string;
    navigateTo?: string;
  }) => void;
};

type PostReviewProps = BaseReviewProps & {
  mode?: 'post';
  word: string;
  dictionary: string;
  slateId: string | null;
  trackSlateAction: (
    action: SlateAction,
    word?: string,
    metadata?: Record<string, string | number>
  ) => Promise<void>;
};

type TournamentReviewProps = BaseReviewProps & {
  mode: 'tournament';
  tournamentPostId: string;
};

type ReviewStepProps = PostReviewProps | TournamentReviewProps;

export function ReviewStep(props: ReviewStepProps) {
  const { drawing, onCancel, onSuccess } = props;
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [entered, setEntered] = useState(false);
  const queryClient = useQueryClient();
  const { track } = useTelemetry();

  // Track review step view on mount
  useEffect(() => {
    void track('view_review_step');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const id = window.setTimeout(() => {
      setEntered(true);
    }, 10);
    return () => {
      window.clearTimeout(id);
    };
  }, []);
  const submitDrawing = trpc.app.post.submitDrawing.useMutation({
    onSuccess: () => {
      // Invalidate relevant queries
      void queryClient.invalidateQueries({
        queryKey: ['pixelary', 'user', 'drawings'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['pixelary', 'leaderboard'],
      });

      // Optionally refetch user profile to update score
      void queryClient.invalidateQueries({
        queryKey: ['pixelary', 'user', 'profile'],
      });
    },
  });
  const submitTournamentDrawing = trpc.app.tournament.submitDrawing.useMutation(
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: ['pixelary', 'app', 'tournament'],
        });
        await queryClient.refetchQueries({
          queryKey: ['pixelary', 'app', 'tournament', 'getStats'],
          exact: false,
        });
        await queryClient.refetchQueries({
          queryKey: [
            'pixelary',
            'app',
            'tournament',
            'getSubmissionsWithDrawings',
          ],
          exact: false,
        });
      },
    }
  );

  const handlePost = async (nativeEvent?: PointerEvent) => {
    void track('click_post_drawing');

    try {
      if (props.mode === 'tournament') {
        await submitTournamentDrawing.mutateAsync({
          postId: props.tournamentPostId,
          drawing,
        });
        // Exit expanded mode after a successful submission
        if (nativeEvent) {
          await exitExpandedMode(nativeEvent).catch(() => undefined);
        }
        onSuccess?.({ success: true });
      } else {
        const { word, dictionary, trackSlateAction } = props;
        const result = await submitDrawing.mutateAsync({
          word,
          dictionary,
          drawing,
        });
        if (result.success) {
          // Attempt to deliver slate event, but cap wait to keep UX snappy
          try {
            await Promise.race([
              trackSlateAction('slate_posted', word, { postId: result.postId }),
              new Promise((resolve) => setTimeout(resolve, 400)),
            ]);
          } catch {
            // Ignore telemetry errors
          }
          const url =
            result.navigateTo ||
            (context.subredditName
              ? `https://reddit.com/r/${context.subredditName}/comments/${result.postId}`
              : undefined);
          if (url) {
            navigateTo(url);
          } else {
            onSuccess?.(result);
          }
        }
      }
    } catch (error) {
      // Handle submission error
    }
  };

  const handleCancel = () => {
    void track('click_cancel_drawing');
    setShowCancelConfirm(true);
  };

  const confirmCancel = () => {
    onCancel();
    setShowCancelConfirm(false);
  };

  return (
    <main className="absolute inset-0 h-full w-full">
      {/* Grouped heading + intro block that slides down together; positioned 24px above the drawing */}
      <div
        className={`absolute left-0 right-0 flex flex-col gap-3 items-center justify-center text-center transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)] transform-gpu ${
          entered ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
        }`}
        style={{
          bottom: 'calc((100% - var(--draw-top, 50%)) + 24px)',
        }}
      >
        <Text scale={3}>That's a wrap!</Text>
        <div className="text-secondary flex flex-col items-center justify-center gap-1">
          {props.mode === 'tournament' ? (
            <>
              <Text>Share your drawing</Text>
              <Text>as a comment to play!</Text>
            </>
          ) : (
            <>
              <Text>Share your drawing</Text>
              <Text>as a post to play!</Text>
            </>
          )}
        </div>
      </div>

      {/* Buttons slide up to 24px below the drawing */}
      <div
        className={`absolute left-0 right-0 flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)] transform-gpu ${
          entered ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}
        style={{
          top: 'calc((var(--draw-top, 50%) + var(--draw-size, 0px)) + 24px)',
        }}
      >
        <div className="flex flex-row gap-3">
          <Button
            variant="secondary"
            size="large"
            onClick={handleCancel}
            disabled={
              props.mode === 'tournament'
                ? submitTournamentDrawing.isPending
                : submitDrawing.isPending
            }
          >
            DELETE
          </Button>

          {props.mode === 'tournament' ? (
            <Button
              size="large"
              onNativeClick={(e) => {
                void handlePost(e.nativeEvent as unknown as PointerEvent);
              }}
              disabled={submitTournamentDrawing.isPending}
            >
              {submitTournamentDrawing.isPending ? 'COMMENTING...' : 'COMMENT'}
            </Button>
          ) : (
            <Button
              size="large"
              onClick={() => void handlePost()}
              disabled={submitDrawing.isPending}
            >
              {submitDrawing.isPending ? 'POSTING...' : 'POST'}
            </Button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showCancelConfirm}
        onClose={() => {
          setShowCancelConfirm(false);
        }}
        onDelete={confirmCancel}
      />
    </main>
  );
}

/*
 * Delete Confirmation Modal
 */

type DeleteConfirmationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
};

function DeleteConfirmationModal(props: DeleteConfirmationModalProps) {
  const { isOpen, onClose, onDelete } = props;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete drawing?">
      {/* Body Copy - Concise and to the point. */}
      <div className="flex flex-col gap-1 items-center justify-center w-full">
        <Text>You cannot undo</Text>
        <Text>this action later</Text>
      </div>

      {/* Actions - The primary action has been placed on the left side and deemphasized to avoid accidental misclicks given the severity of the action.
       */}
      <div className="flex flex-row gap-3 items-center justify-center w-full">
        <Button
          variant="white"
          onNativeClick={(e) => {
            void exitExpandedMode(
              e.nativeEvent as unknown as PointerEvent
            ).catch(() => undefined);
          }}
          onClick={onDelete}
        >
          Delete
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}
