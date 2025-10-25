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
import type { SlateAction } from '@shared/types';
import { renderDrawingToCanvas } from '@shared/utils/drawing';

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
  slateId: string | null;
  trackSlateAction: (
    action: SlateAction,
    word?: string,
    metadata?: Record<string, string | number>
  ) => Promise<void>;
}

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
  const {
    word,
    dictionaryName,
    drawing,
    onCancel,
    onSuccess,
    trackSlateAction,
  } = props;
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const queryClient = useQueryClient();
  const { track } = useTelemetry();

  // Track review step view on mount
  useEffect(() => {
    void track('view_review_step');
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
        dictionary: dictionaryName,
        drawing: drawing,
        imageData,
      });

      if (result.success) {
        // Track slate publish - await to ensure delivery before navigation
        await trackSlateAction('slate_posted', word);

        if (result.navigateTo) {
          navigateTo(result.navigateTo);
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
    <main className="fixed inset-0 flex flex-col items-center justify-center h-full gap-6 p-6">
      {/* Header */}
      <PixelFont scale={3}>That's a wrap!</PixelFont>

      {/* Drawing Preview */}
      <Drawing data={drawing} size={256} />

      {/* Instructions */}
      <div className="flex flex-col items-center justify-center gap-1 text-center text-brand-secondary">
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
