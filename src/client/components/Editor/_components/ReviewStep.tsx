import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@components/Button';
import { Drawing } from '@components/Drawing';
import { Modal } from '@components/Modal';
import { trpc } from '@client/trpc/client';
import { DrawingData } from '@shared/schema/drawing';
import { PixelFont } from '@components/PixelFont';
import { navigateTo } from '@devvit/web/client';
import { useTelemetry } from '@client/hooks/useTelemetry';
import { useEffect } from 'react';

interface ReviewStepProps {
  word: string;
  dictionaryName: string;
  drawing: DrawingData;
  onCancel: () => void;
  onSuccess?: (result: {
    success: boolean;
    postId: string;
    navigateTo?: string;
  }) => void;
}

export function ReviewStep(props: ReviewStepProps) {
  const { word, dictionaryName, drawing, onCancel, onSuccess } = props;
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const queryClient = useQueryClient();
  const { track } = useTelemetry();

  // Track review step view on mount
  useEffect(() => {
    track('view_review_step');
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

  const handlePost = async () => {
    track('click_post_drawing');

    try {
      const result = await submitDrawing.mutateAsync({
        word,
        dictionary: dictionaryName,
        drawing: drawing,
      });

      if (result.success) {
        if (result.navigateTo) {
          navigateTo(result.navigateTo);
        } else if (onSuccess) {
          onSuccess(result);
        }
      }
    } catch (error) {
      console.error('Failed to submit drawing:', error);
    }
  };

  const handleCancel = () => {
    track('click_cancel_drawing');
    setShowCancelConfirm(true);
  };

  const confirmCancel = () => {
    onCancel();
    setShowCancelConfirm(false);
  };

  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center h-full gap-6 p-6">
      {/* Header */}
      <PixelFont scale={3}>That's a wrap!</PixelFont>

      {/* Drawing Preview */}
      <Drawing data={drawing} size={256} />

      {/* Instructions */}
      <div className="flex flex-col items-center justify-center gap-1 text-center text-[var(--color-brand-secondary)]">
        <PixelFont scale={2}>Post your drawing</PixelFont>
        <PixelFont scale={2}>and earn points for</PixelFont>
        <PixelFont scale={2}>every correct guess!</PixelFont>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-row gap-3">
        <Button
          variant="secondary"
          onClick={handleCancel}
          disabled={submitDrawing.isPending}
        >
          DELETE
        </Button>

        <Button onClick={handlePost} disabled={submitDrawing.isPending}>
          {submitDrawing.isPending ? 'POSTING...' : 'POST'}
        </Button>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onDelete={confirmCancel}
      />
    </main>
  );
}

/*
 * Delete Confirmation Modal
 */

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
}

function DeleteConfirmationModal(props: DeleteConfirmationModalProps) {
  const { isOpen, onClose, onDelete } = props;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete drawing?">
      {/* Body Copy - Concise and to the point. */}
      <div className="flex flex-col gap-1 items-center justify-center w-full">
        <PixelFont>You cannot undo</PixelFont>
        <PixelFont>this action later</PixelFont>
      </div>

      {/* Actions - The primary action has been placed on the left side and deemphasized to avoid accidental misclicks given the severity of the action.
       */}
      <div className="flex flex-row gap-3 items-center justify-center w-full">
        <Button variant="white" onClick={onDelete}>
          Delete
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}
