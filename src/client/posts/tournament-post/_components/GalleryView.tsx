import { useState } from 'react';
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

type SortBy = 'score' | 'recency' | 'mine';

export function GalleryView({
  postId,
  stats,
  onDraw,
  onToggleView,
}: GalleryViewProps) {
  const [sortBy, setSortBy] = useState<SortBy>('recency');

  const {
    data: submissions,
    isLoading,
    error,
  } = trpc.app.tournament.getSubmissionsWithDrawings.useQuery(
    { postId, sortBy },
    { enabled: !!postId }
  );

  console.log('Gallery submissions:', submissions);

  const handleDrawingClick = (commentId: string) => {
    // Future: Show lightbox or detail view
    console.log('Drawing clicked:', commentId);
  };

  const drawings =
    submissions?.map((sub) => ({
      postId: sub.commentId,
      drawing: sub.drawing,
    })) || [];

  console.log('Mapped drawings:', drawings);

  return (
    <div className="flex flex-col gap-6 items-center w-full">
      {/* Header with view toggle */}
      <div className="absolute top-6 right-6">
        <Button onClick={onToggleView} size="medium" variant="secondary">
          VOTING
        </Button>
      </div>

      {/* Sort buttons */}
      <div className="flex gap-2">
        <Button
          onClick={() => setSortBy('recency')}
          variant={sortBy === 'recency' ? 'primary' : 'secondary'}
          size="medium"
        >
          Recent
        </Button>
        <Button
          onClick={() => setSortBy('score')}
          variant={sortBy === 'score' ? 'primary' : 'secondary'}
          size="medium"
        >
          Top
        </Button>
        <Button
          onClick={() => setSortBy('mine')}
          variant={sortBy === 'mine' ? 'primary' : 'secondary'}
          size="medium"
        >
          Mine
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
      {!error && isLoading ? (
        <div className="flex items-center justify-center w-full h-64">
          <PixelFont>Loading...</PixelFont>
        </div>
      ) : !error && drawings.length === 0 ? (
        <div className="flex flex-col gap-2 items-center w-full">
          <PixelFont className="text-tertiary">
            {sortBy === 'mine'
              ? "You haven't submitted any drawings yet"
              : 'No drawings yet'}
          </PixelFont>
        </div>
      ) : (
        !error && (
          <PaginatedDrawingGrid
            drawings={drawings}
            onDrawingClick={handleDrawingClick}
            isLoading={isLoading}
          />
        )
      )}

      {stats !== undefined && (
        <Button onClick={onDraw} size="large">
          I CAN DO BETTER
        </Button>
      )}
    </div>
  );
}
