import { Background } from '@components/Background';
import { DrawingEditor } from '@client/entries/editor/_components/Editor';
import { context } from '@devvit/web/client';
import { getPostData } from '@client/utils/context';
import type { TournamentPostData } from '@shared/schema';
import { renderEntry } from '@client/utils/renderEntry';
import { useEffect } from 'react';
import { trpc } from '@client/trpc/client';

function App() {
  const postData = getPostData<TournamentPostData>();
  const isTournament =
    postData?.type === 'tournament' && Boolean(postData.word);
  const utils = trpc.useUtils();

  // If this editor session is for a tournament comment, warm relevant caches
  useEffect(() => {
    if (isTournament) {
      void utils.app.user.getProfile.prefetch();
      void utils.app.rewards.getEffectiveBonuses.prefetch();
    }
  }, [isTournament, utils]);

  return (
    <>
      <Background />
      {isTournament ? (
        <DrawingEditor
          onClose={() => {
            return;
          }}
          mode="tournament-comment"
          tournamentPostId={context.postId}
          tournamentWord={postData.word}
        />
      ) : (
        <DrawingEditor
          onClose={() => {
            return;
          }}
        />
      )}
    </>
  );
}

renderEntry(<App />);
