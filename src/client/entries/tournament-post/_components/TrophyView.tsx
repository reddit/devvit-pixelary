import { useState } from 'react';
import { trpc } from '@client/trpc/client';
import { Drawing } from '@components/Drawing';
import { Text } from '@components/PixelFont';
import { IconButton } from '@components/IconButton';
import { Button } from '@components/Button';
import { Lightbox } from '@components/Lightbox';
import type { DrawingData } from '@shared/schema/drawing';
import { requestExpandedMode } from '@devvit/web/client';

type TrophyViewProps = {
  postId: string;
  onToggleView: () => void;
  onDraw: () => void;
};

type TrophyPosition = 'gold' | 'silver' | 'bronze';

type WinnerDisplayProps = {
  position: TrophyPosition;
  artist: string;
  rating: number;
  drawing: DrawingData;
  onClick: () => void;
};

function TrophyIcon({ position }: { position: TrophyPosition }) {
  const colors = {
    gold: '#F2C94C',
    silver: '#C0C0C0',
    bronze: '#CD7F32',
  };

  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9 11H3V10H9V11ZM7 9H5V7H7V9ZM9 5H8V6H4V5H3V1H9V5ZM2 4H1V2H2V4ZM11 4H10V2H11V4Z"
        fill={colors[position]}
      />
      <path
        d="M3 11H9V10H10V12H2V10H3V11ZM10 1H12V4H11V2H10V4H11V5H10V6H9V7H8V9H9V10H3V9H4V7H3V6H2V5H1V4H2V2H1V4H0V1H2V0H10V1ZM5 9H7V7H5V9ZM3 5H4V6H8V5H9V1H3V5Z"
        fill="black"
        fill-opacity="0.8"
      />
      <path d="M5 3H4V1H5V3Z" fill="white" fill-opacity="0.5" />
      <path
        d="M9 11H7V10H9V11ZM7 9H6V7H7V9ZM8 6H7V5H8V6ZM9 5H8V1H9V5ZM11 4H10V2H11V4Z"
        fill="black"
        fill-opacity="0.3"
      />
    </svg>
  );
}

function WinnerDisplay({
  position,
  artist,
  rating,
  drawing,
  onClick,
}: WinnerDisplayProps) {
  return (
    <div className="flex flex-row gap-4 items-center justify-center">
      <button
        onClick={onClick}
        className="cursor-pointer hover:opacity-80 transition-opacity"
      >
        <Drawing data={drawing} size={96} />
      </button>
      <TrophyIcon position={position} />
      <div className="flex flex-col gap-1 items-start">
        <Text scale={2.5} className="text-primary">
          {artist}
        </Text>
        <Text scale={2} className="text-tertiary">
          {`${Math.round(rating)} rating`}
        </Text>
      </div>
    </div>
  );
}

export function TrophyView({ postId, onToggleView, onDraw }: TrophyViewProps) {
  const [selectedDrawing, setSelectedDrawing] = useState<{
    drawing: DrawingData;
    author: string;
    rating: number;
    votes: number;
    views: number;
    commentId: string;
  } | null>(null);

  const {
    data: submissions,
    isLoading,
    error,
  } = trpc.app.tournament.getSubmissionsWithDrawings.useQuery({ postId });

  const incrementViews = trpc.app.tournament.incrementViews.useMutation();

  // Get top 3 submissions
  const top3 = submissions?.slice(0, 3) ?? [];

  const errorMessage = (() => {
    const msg = (error as { message?: unknown } | undefined)?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
    return 'Failed to load';
  })();

  const handleDrawingClick = (index: number) => {
    const submission = top3[index];
    if (submission) {
      setSelectedDrawing({
        drawing: submission.drawing,
        author: submission.username,
        rating: submission.rating,
        votes: submission.votes,
        views: submission.views,
        commentId: submission.commentId,
      });
      // Track view when opening lightbox
      void incrementViews.mutateAsync({ commentId: submission.commentId });
    }
  };

  if (error) {
    return (
      <main className="absolute inset-0 flex flex-col p-4 gap-4">
        <header className="shrink-0 w-full flex flex-row items-center justify-between">
          <Text scale={2.5}>In the lead</Text>
          <IconButton onClick={onToggleView} symbol="X" />
        </header>
        <div className="flex items.center justify.center w.full h.full">
          <Text className="text-red-500">{`Error: ${errorMessage}`}</Text>
        </div>
      </main>
    );
  }

  return (
    <main className="absolute inset-0 flex flex.col p-4 gap-6 items.center justify.center">
      {/* Header */}
      <header className="shrink-0 w-full flex flex-row items-center justify-between">
        <Text scale={2.5}>In the lead</Text>
        <IconButton onClick={onToggleView} symbol="X" />
      </header>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex items-center justify-center w-full h-full">
          <Text className="text-tertiary">Loading...</Text>
        </div>
      ) : top3.length === 0 ? (
        <div className="flex items-center justify-center w-full h-full">
          <Text className="text-tertiary">No winners yet</Text>
        </div>
      ) : (
        <div className="flex flex-col gap-6 items-center justify-center w-full h-full flex-1">
          {top3.length >= 1 && top3[0] && (
            <WinnerDisplay
              position="gold"
              artist={top3[0].username}
              rating={top3[0].rating}
              drawing={top3[0].drawing}
              onClick={() => {
                handleDrawingClick(0);
              }}
            />
          )}
          {top3.length >= 2 && top3[1] && (
            <WinnerDisplay
              position="silver"
              artist={top3[1].username}
              rating={top3[1].rating}
              drawing={top3[1].drawing}
              onClick={() => {
                handleDrawingClick(1);
              }}
            />
          )}
          {top3.length >= 3 && top3[2] && (
            <WinnerDisplay
              position="bronze"
              artist={top3[2].username}
              rating={top3[2].rating}
              drawing={top3[2].drawing}
              onClick={() => {
                handleDrawingClick(2);
              }}
            />
          )}
        </div>
      )}
      {/* Draw button at the bottom */}
      <Button
        onNativeClick={(e) => {
          void requestExpandedMode(
            e.nativeEvent as unknown as MouseEvent,
            'editor'
          );
        }}
        size="large"
        className="w-min"
      >
        DRAW THE WORD
      </Button>

      {/* Lightbox */}
      {selectedDrawing && (
        <Lightbox
          isOpen
          onClose={() => {
            setSelectedDrawing(null);
          }}
          drawing={selectedDrawing.drawing}
          author={selectedDrawing.author}
        >
          <div className="flex flex-col gap-2 items-center">
            <Text>
              {`${selectedDrawing.views} views · ${selectedDrawing.votes} picks (${selectedDrawing.views > 0 ? Math.round((selectedDrawing.votes / selectedDrawing.views) * 100) : 0}%)`}
            </Text>
            <Text>{`${selectedDrawing.rating} rating`}</Text>
          </div>
        </Lightbox>
      )}
    </main>
  );
}
