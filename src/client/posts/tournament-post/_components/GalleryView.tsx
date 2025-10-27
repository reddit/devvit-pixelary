import { useState } from 'react';
import { trpc } from '@client/trpc/client';
import { PaginatedDrawingGrid } from '@components/PaginatedDrawingGrid';
import { PixelFont } from '@components/PixelFont';
import { IconButton } from '@components/IconButton';
import { Lightbox } from '@components/Lightbox';
import type { DrawingData } from '@shared/schema/drawing';

function TournamentLightboxContent({
  rating,
  votes,
}: {
  rating: number;
  votes: number;
}) {
  return (
    <div className="flex flex-col gap-1 items-center">
      <PixelFont scale={1.5}>{`${votes} picks`}</PixelFont>
      <PixelFont scale={1.5}>{`${rating} rating`}</PixelFont>
    </div>
  );
}

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
  } | null>(null);

  const {
    data: submissions,
    isLoading,
    error,
  } = trpc.app.tournament.getSubmissionsWithDrawings.useQuery(
    { postId },
    { enabled: !!postId }
  );

  const handleDrawingClick = (postId: string) => {
    const submission = submissions?.find((sub) => sub.commentId === postId);
    if (submission) {
      setSelectedDrawing({
        drawing: submission.drawing,
        author: submission.username,
        rating: submission.rating,
        votes: submission.votes,
      });
    }
  };

  const drawings =
    submissions?.map((sub) => ({
      postId: sub.commentId,
      drawing: sub.drawing,
      rating: sub.rating,
    })) || [];

  return (
    <main className="absolute inset-0 flex flex-col p-4 gap-4">
      {/* Header */}
      <header className="shrink-0 w-full flex flex-row items-center justify-between">
        <PixelFont scale={2.5}>All drawings</PixelFont>
        <IconButton onClick={onToggleView} symbol="X" />
      </header>

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

      {/* Lightbox */}
      {selectedDrawing && (
        <Lightbox
          isOpen={selectedDrawing !== null}
          onClose={() => setSelectedDrawing(null)}
          drawing={selectedDrawing.drawing}
          author={selectedDrawing.author}
        >
          <TournamentLightboxContent
            rating={selectedDrawing.rating}
            votes={selectedDrawing.votes}
          />
        </Lightbox>
      )}
    </main>
  );
}
