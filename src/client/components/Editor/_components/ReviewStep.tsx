import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@components/Button';
import { Drawing } from '@components/Drawing';
import { Modal } from '@components/Modal';
import { trpc } from '@client/trpc/client';
import type { DrawingData } from '@shared/schema/drawing';
import { Text } from '@components/PixelFont';
import { navigateTo, context } from '@devvit/web/client';
import { useTelemetry } from '@client/hooks/useTelemetry';
import { useEffect } from 'react';
import type { SlateAction } from '@shared/types';
import { renderDrawingToCanvas } from '@shared/utils/drawing';

type ReviewStepProps = {
  word: string;
  dictionary: string;
  drawing: DrawingData;
  onCancel: () => void;
  onSuccess?: (result: {
    success: boolean;
    postId: string;
    navigateTo?: string;
  }) => void;
  slateId: string | null;
  trackSlateAction: (
    action: SlateAction,
    word?: string,
    metadata?: Record<string, string | number>
  ) => Promise<void>;
};

/**
 * Generate a PNG data URL from DrawingData
 * @param drawingData - The drawing data to convert to PNG
 * @returns Base64-encoded PNG data URL
 */
function generatePNGFromDrawing(drawingData: DrawingData): string {
  // Create an off-screen canvas
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Disable image smoothing for crisp pixels
  ctx.imageSmoothingEnabled = false;

  // Create a temporary canvas for the original drawing
  const tempCanvas = document.createElement('canvas');
  renderDrawingToCanvas(drawingData, tempCanvas);

  // Scale the drawing to 256x256
  ctx.drawImage(tempCanvas, 0, 0, 256, 256);

  // Convert to PNG data URL
  return canvas.toDataURL('image/png');
}

export function ReviewStep(props: ReviewStepProps) {
  const { word, dictionary, drawing, onCancel, onSuccess, trackSlateAction } =
    props;
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const queryClient = useQueryClient();
  const { track } = useTelemetry();

  // Track review step view on mount
  useEffect(() => {
    void track('view_review_step');
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    void track('click_post_drawing');

    try {
      // Generate PNG from drawing data
      const imageData = generatePNGFromDrawing(drawing);

      const result = await submitDrawing.mutateAsync({
        word,
        dictionary: dictionary,
        drawing: drawing,
        imageData,
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
        } else if (onSuccess) {
          onSuccess(result);
        }
      } else {
        // Handle unsuccessful submission
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
    <main className="absolute inset-0 flex flex-col items-center justify-center h-full gap-6 p-6">
      {/* Header */}
      <Text scale={3}>That's a wrap!</Text>

      {/* Drawing Preview */}
      <Drawing data={drawing} size={256} />

      {/* Instructions */}
      <div className="flex flex-col items-center justify-center gap-1 text-center text-secondary">
        <Text scale={2}>Post your drawing</Text>
        <Text scale={2}>and earn points for</Text>
        <Text scale={2}>every correct guess!</Text>
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
        <Button variant="white" onClick={onDelete}>
          Delete
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}
