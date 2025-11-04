import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@components/Button';
import { Drawing } from '@components/Drawing';
import { Modal } from '@components/Modal';
import { trpc } from '@client/trpc/client';
import type { DrawingData } from '@shared/schema/drawing';
import { Text } from '@components/PixelFont';
import { useTelemetry } from '@client/hooks/useTelemetry';
import { exitExpandedMode } from '@devvit/web/client';
import { renderDrawingToCanvas } from '@shared/utils/drawing';

type TournamentReviewStepProps = {
  drawing: DrawingData;
  onCancel: () => void;
  onSuccess?: () => void;
  tournamentPostId: string;
};

function generatePNGFromDrawing(drawingData: DrawingData): string {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.imageSmoothingEnabled = false;

  const tempCanvas = document.createElement('canvas');
  renderDrawingToCanvas(drawingData, tempCanvas);

  ctx.drawImage(tempCanvas, 0, 0, 256, 256);

  return canvas.toDataURL('image/png');
}

export function TournamentReviewStep(props: TournamentReviewStepProps) {
  const { drawing, onCancel, onSuccess, tournamentPostId } = props;
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const queryClient = useQueryClient();
  const { track } = useTelemetry();

  const submitTournamentDrawing = trpc.app.tournament.submitDrawing.useMutation(
    {
      onSuccess: async () => {
        // Invalidate and refetch all tournament queries
        await queryClient.invalidateQueries({
          queryKey: ['pixelary', 'app', 'tournament'],
        });
        // Refetch stats and submissions for the specific post
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

  const handlePost = async () => {
    void track('click_post_drawing');

    try {
      const imageData = generatePNGFromDrawing(drawing);

      console.log(
        'TournamentReviewStep: Submitting with postId:',
        tournamentPostId
      );

      await submitTournamentDrawing.mutateAsync({
        postId: tournamentPostId,
        drawing,
        imageData,
      });

      console.log('TournamentReviewStep: Submission successful');

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Failed to submit tournament drawing:', error);
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
    <main className="absolute inset-0 flex flex-col items-center justify-center h-full gap-6 p-6">
      <Text scale={3}>That's a wrap!</Text>

      <Drawing data={drawing} size={256} />

      <div className="flex flex-col items-center justify-center gap-1 text-center text-secondary">
        <Text scale={2}>Submit your drawing</Text>
        <Text scale={2}>to join tournament.</Text>
      </div>

      <div className="flex flex-row gap-3">
        <Button
          variant="secondary"
          onClick={handleCancel}
          disabled={submitTournamentDrawing.isPending}
        >
          DELETE
        </Button>

        <Button
          onClick={handlePost}
          disabled={submitTournamentDrawing.isPending}
        >
          {submitTournamentDrawing.isPending ? 'SUBMITTING...' : 'SUBMIT'}
        </Button>
      </div>

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

type DeleteConfirmationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
};

function DeleteConfirmationModal(props: DeleteConfirmationModalProps) {
  const { isOpen, onClose, onDelete } = props;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete drawing?">
      <div className="flex flex-col gap-1 items-center justify-center w-full">
        <Text>You cannot undo</Text>
        <Text>this action later</Text>
      </div>

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
