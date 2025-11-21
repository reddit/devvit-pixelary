import { Background } from '@components/Background';
import { EditorContextProvider } from '@client/entries/editor/_context/EditorContext';
import { EditorRouter } from '@client/entries/editor/_components/EditorRouter';
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

  // Always warm recent colors so Palette can hydrate quickly
  useEffect(() => {
    void utils.app.user.colors.getRecent.prefetch();
  }, [utils]);

  return (
    <>
      <Background />
      {isTournament ? (
        <EditorContextProvider
          mode="tournament-comment"
          tournamentPostId={context.postId}
          tournamentWord={postData.word}
        >
          <EditorRouter />
        </EditorContextProvider>
      ) : (
        <EditorContextProvider>
          <EditorRouter />
        </EditorContextProvider>
      )}
    </>
  );
}

renderEntry(<App />);
