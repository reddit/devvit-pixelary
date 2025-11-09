import { Button } from '@components/Button';
import { trpc } from '@client/trpc/client';
import { Text } from '@components/PixelFont';
import { IconButton } from '@components/IconButton';
import { PaginatedDrawingGrid } from '@components/PaginatedDrawingGrid';
import { navigateTo } from '@devvit/web/client';
import { context } from '@devvit/web/client';
import { useTelemetry } from '@client/hooks/useTelemetry';
import { useEffect, useMemo } from 'react';

type MyDrawingsProps = {
  onClose: () => void;
};

export function MyDrawings({ onClose }: MyDrawingsProps) {
  // Telemetry
  const { track } = useTelemetry();
  useEffect(() => {
    void track('view_my_drawings');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Grab paginated blended data (first page)
  const { data, isLoading } = trpc.app.user.getMyArtPage.useQuery({
    limit: 20,
  });
  const items = data?.items ?? [];
  const byId = useMemo(() => {
    const map = new Map<string, (typeof items)[number]>();
    items.forEach((it) => map.set(it.id, it));
    return map;
  }, [items]);
  const drawings = useMemo(
    () => items.map((it) => ({ postId: it.id, drawing: it.drawing })),
    [items]
  );

  return (
    <main className="absolute inset-0 flex flex-col p-4 gap-4">
      {/* Header */}
      <header className="shrink-0 w-full flex flex-row items-center justify-between">
        <Text scale={2.5}>My Drawings</Text>

        <IconButton
          onClick={onClose}
          symbol="X"
          telemetryEvent="click_close_my_drawings"
        />
      </header>

      {/* Loading and Drawing Tiles */}
      <PaginatedDrawingGrid
        drawings={drawings}
        onDrawingClick={async (id) => {
          // Track drawing tile click - await to ensure delivery before navigation
          await track('click_drawing_tile');

          // Navigate to drawing post or tournament comment permalink
          const item = byId.get(id);
          const subredditName = context.subredditName;
          if (subredditName && item) {
            if (item.type === 'drawing') {
              navigateTo(
                `https://reddit.com/r/${subredditName}/comments/${item.postId}`
              );
            } else {
              navigateTo(
                `https://reddit.com/r/${subredditName}/comments/${item.postId}/_/${item.commentId}`
              );
            }
          }
        }}
        isLoading={isLoading}
      />

      {/* Empty state */}
      {drawings.length === 0 && !isLoading && (
        <div className="flex-1 flex flex-col gap-4 items-center justify-center">
          <Text className="text-muted">No drawings yet.</Text>
          <Button onClick={onClose} telemetryEvent="click_start_drawing">
            New Drawing
          </Button>
        </div>
      )}
    </main>
  );
}
