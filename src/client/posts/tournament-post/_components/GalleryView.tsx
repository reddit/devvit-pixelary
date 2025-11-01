import { useState } from 'react';
import { trpc } from '@client/trpc/client';
import { PaginatedDrawingGrid } from '@components/PaginatedDrawingGrid';
import { Text } from '@components/PixelFont';
import { IconButton } from '@components/IconButton';
import { Lightbox } from '@components/Lightbox';
import type { DrawingData } from '@shared/schema/drawing';

interface GalleryViewProps {
  postId: string;
  onToggleView: () => void;
}

export function GalleryView({ postId, onToggleView }: GalleryViewProps) {
  const [selectedDrawing, setSelectedDrawing] = useState<{
    drawing: DrawingData;
    author: string;
    rating: number;
    votes: number;
    views: number;
  } | null>(null);

  const {
    data: submissions,
    isLoading,
    error,
  } = trpc.app.tournament.getSubmissionsWithDrawings.useQuery(
    { postId },
    { enabled: !!postId }
  );

  const incrementViews = trpc.app.tournament.incrementViews.useMutation();

  const handleDrawingClick = (postId: string) => {
    const submission = submissions?.find((sub) => sub.commentId === postId);
    if (submission) {
      setSelectedDrawing({
        drawing: submission.drawing,
        author: submission.username,
        rating: submission.rating,
        votes: submission.votes,
        views: submission.views,
      });
      // Track view when opening lightbox
      void incrementViews.mutateAsync({ commentId: postId });
    }
  };

  const drawings =
    submissions?.map((sub) => ({
      postId: sub.commentId,
      drawing: sub.drawing,
    })) || [];

  return (
    <main className="absolute inset-0 flex flex-col p-4 gap-4">
      {/* Header */}
      <header className="shrink-0 w-full flex flex-row items-center justify-between">
        <Text scale={2.5}>All drawings</Text>
        <IconButton onClick={onToggleView} symbol="X" />
      </header>

      {/* Error state */}
      {error && (
        <div className="flex items-center justify-center w-full">
          <Text className="text-red-500">
            {`Error: ${Array.isArray(error.message) ? error.message.join(', ') : error.message || 'Failed to load'}`}
          </Text>
        </div>
      )}

      {/* Gallery or empty state */}
      {isLoading ? (
        <div className="flex items-center justify-center w-full h-full">
          <Text className="text-tertiary">Loading ...</Text>
        </div>
      ) : submissions && submissions.length > 0 && drawings.length > 0 ? (
        <PaginatedDrawingGrid
          drawings={drawings}
          onDrawingClick={handleDrawingClick}
          isLoading={isLoading}
        />
      ) : (
        <div className="h-full flex flex-col gap-2 items-center justify-center w-full">
          <Text className="text-tertiary">No drawings yet</Text>
        </div>
      )}

      {/* Lightbox */}
      {selectedDrawing && (
        <Lightbox
          isOpen={selectedDrawing !== null}
          onClose={() => setSelectedDrawing(null)}
          drawing={selectedDrawing.drawing}
          author={selectedDrawing.author}
        >
          <div className="flex flex-col gap-2 items-center">
            <Text>
              {`${selectedDrawing.views} views · ${selectedDrawing.votes} picks (${
                selectedDrawing.views > 0
                  ? Math.round(
                      (selectedDrawing.votes / selectedDrawing.views) * 100
                    )
                  : 0
              }%)`}
            </Text>
            <Text>{`${selectedDrawing.rating} rating`}</Text>
          </div>
        </Lightbox>
      )}
    </main>
  );
}
