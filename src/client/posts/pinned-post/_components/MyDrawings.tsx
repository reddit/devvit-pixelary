import { Button } from '../../../components/Button';
import { trpc } from '../../../trpc/client';
import { Drawing } from '../../../components/Drawing';
import { PixelFont } from '../../../components/PixelFont';
import { IconButton } from '../../../components/IconButton';
import { navigateTo } from '@devvit/web/client';
import { context } from '@devvit/web/client';

export interface MyDrawingsProps {
  onClose: () => void;
}

export function MyDrawings({ onClose }: MyDrawingsProps) {
  const { data: drawings = [], isLoading } = trpc.app.user.getDrawings.useQuery(
    { limit: 20 }
  );

  return (
    <main className="fixed inset-0 flex flex-col p-4 gap-4">
      {/* Header */}
      <header className="shrink-0 w-full flex flex-row items-center justify-between">
        <PixelFont scale={2.5}>My Drawings</PixelFont>

        <IconButton onClick={onClose} symbol="X" />
      </header>

      {/* Skeleton Loading State */}
      {isLoading && (
        <div className="flex w-full h-full flex-row gap-3 flex-wrap items-start justify-center">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="w-[88px] h-[88px] bg-gray-200 animate-pulse rounded"
            />
          ))}
        </div>
      )}

      {/* Drawing Tiles */}
      {drawings.length > 0 && !isLoading && (
        <div className="flex w-full h-full flex-row gap-3 flex-wrap items-start justify-center">
          {drawings.map((drawing) => (
            <Drawing
              key={drawing.postId}
              data={drawing.drawing}
              size={88}
              onClick={() => {
                // Navigate to drawing post
                const subredditName = context.subredditName;
                if (subredditName) {
                  navigateTo(
                    `https://reddit.com/r/${subredditName}/comments/${drawing.postId}`
                  );
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {drawings.length === 0 && !isLoading && (
        <div className="p-6 text-center">
          <div className="mb-6">
            <h2 className="font-pixel text-pixel-text-scale-3">My Drawings</h2>
          </div>
          <div className="mb-6">
            <p className="font-pixel text-gray-600">
              You haven't created any drawings yet.
            </p>
          </div>
          <Button onClick={onClose}>Start Drawing</Button>
        </div>
      )}
    </main>
  );
}
