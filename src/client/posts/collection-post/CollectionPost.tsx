import { trpc } from '@client/trpc/client';
import { getPostData } from '@client/utils/context';
import { Drawing } from '@client/components/Drawing';
import { PixelFont } from '@client/components/PixelFont';
import { Button } from '@client/components/Button';
import { Shimmer } from '@client/components/Shimmer';
import { CyclingMessage } from '@client/components/CyclingMessage';
import { context, navigateTo } from '@devvit/web/client';
import type { CollectionPostData } from '@src/shared/schema';

export function CollectionPost() {
  const postData = getPostData<CollectionPostData>();

  if (!postData || postData.type !== 'collection') {
    return null;
  }

  const { data, isLoading, error } = trpc.app.post.getCollection.useQuery({
    collectionId: postData.collectionId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <PixelFont>Loading...</PixelFont>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <PixelFont>Failed to load collection</PixelFont>
      </div>
    );
  }

  if (data.drawings.length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <PixelFont>No drawings found</PixelFont>
      </div>
    );
  }

  const handleDrawingClick = (postId: string) => {
    const url = `https://reddit.com/r/${context.subredditName}/comments/${postId}`;
    navigateTo(url);
  };

  const handleVisit = () => {
    const url = `https://reddit.com/r/${context.subredditName}`;
    navigateTo(url);
  };

  const titleLines = data.label
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return (
    <div className="absolute flex flex-col gap-6 items-center justify-center h-full w-full text-black">
      <div className="flex flex-col gap-2 items-center justify-center">
        {titleLines.map((line, index) => (
          <PixelFont key={index} scale={3}>
            {line}
          </PixelFont>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {data.drawings.map((d) => (
          <Drawing
            key={d.postId}
            data={d.drawing}
            size={88}
            onClick={() => handleDrawingClick(d.postId)}
          />
        ))}
      </div>

      <CyclingMessage
        messages={[
          'Click to view drawings',
          'Check out the comments',
          'Thanks for playing',
        ]}
        className="text-secondary"
      />

      <Button onClick={handleVisit} size="large">
        {`Visit r/${context.subredditName}`}
      </Button>

      {/* Timed shimmer overlay */}
      <Shimmer />
    </div>
  );
}
