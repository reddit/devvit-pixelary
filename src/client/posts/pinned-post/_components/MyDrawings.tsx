import { Button } from '../../../components/Button';
import { trpc } from '../../../trpc/client';
import { Drawing } from '../../../components/Drawing';
import { PixelFont } from '../../../components/PixelFont';
import { IconButton } from '../../../components/IconButton';
import { DrawingData } from '../../../../shared/schema/drawing';
import { navigateTo } from '@devvit/web/client';
import { context } from '@devvit/web/client';

export interface MyDrawingsProps {
  onClose: () => void;
}

export function MyDrawings({ onClose }: MyDrawingsProps) {
  const { data: drawingIds = [], isLoading: isLoadingIds } =
    trpc.app.user.getDrawings.useQuery({ limit: 20 });
  const { data: drawings = [], isLoading: isLoadingDrawings } =
    trpc.app.post.getDrawings.useQuery(
      { postIds: drawingIds },
      { enabled: drawingIds.length > 0 }
    );

  const isLoading = isLoadingIds || isLoadingDrawings;

  // if (isLoading) {
  //   return (
  //     <div className="p-6">
  //       <div className="mb-6">
  //         <h2 className="font-pixel text-pixel-text-scale-3">My Drawings</h2>
  //       </div>
  //       <div className="grid grid-cols-2 gap-4">
  //         {Array.from({ length: 6 }).map((_, i) => (
  //           <Skeleton key={i} width={144} height={144} />
  //         ))}
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <main className="fixed inset-0 flex flex-col p-4 gap-4">
      {/* Header */}
      <header className="shrink-0 w-full flex flex-row items-center justify-between">
        <PixelFont scale={2.5}>My Drawings</PixelFont>

        <IconButton onClick={onClose} symbol="X" />
      </header>

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
