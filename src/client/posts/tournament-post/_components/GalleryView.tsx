import { trpc } from '@client/trpc/client';
import { PaginatedDrawingGrid } from '@components/PaginatedDrawingGrid';
import { Button } from '@components/Button';
import { PixelFont } from '@components/PixelFont';

interface GalleryViewProps {
  postId: string;
  stats:
    | {
        submissionCount: number;
        playerCount: number;
      }
    | undefined;
  onDraw: () => void;
  onToggleView: () => void;
}

export function GalleryView({
  postId,
  stats,
  onDraw,
  onToggleView,
}: GalleryViewProps) {
  const {
    data: submissions,
    isLoading,
    error,
  } = trpc.app.tournament.getSubmissionsWithDrawings.useQuery(
    { postId },
    { enabled: !!postId }
  );

  const handleDrawingClick = (commentId: string) => {
    // Future: Show lightbox or detail view
    console.log('Drawing clicked:', commentId);
  };

  const drawings =
    submissions?.map((sub) => ({
      postId: sub.commentId,
      drawing: sub.drawing,
      rating: sub.rating,
    })) || [];

  return (
    <div className="flex flex-col gap-6 items-center w-full">
      {/* Header with view toggle */}
      <div className="absolute top-6 right-6">
        <Button onClick={onToggleView} size="medium" variant="secondary">
          VOTING
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center justify-center w-full">
          <PixelFont className="text-red-500">
            {`Error: ${Array.isArray(error.message) ? error.message.join(', ') : error.message || 'Failed to load'}`}
          </PixelFont>
        </div>
      )}

      {/* Gallery or empty state */}
      {isLoading ? (
        <div className="flex items-center justify-center w-full h-64">
          <PixelFont>Loading...</PixelFont>
        </div>
      ) : submissions && submissions.length > 0 && drawings.length > 0 ? (
        <PaginatedDrawingGrid
          drawings={drawings}
          onDrawingClick={handleDrawingClick}
          isLoading={isLoading}
        />
      ) : (
        <div className="flex flex-col gap-2 items-center w-full">
          <PixelFont className="text-tertiary">No drawings yet</PixelFont>
        </div>
      )}

      {stats !== undefined && (
        <Button onClick={onDraw} size="large">
          I CAN DO BETTER
        </Button>
      )}
    </div>
  );
}
