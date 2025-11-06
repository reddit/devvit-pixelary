import { Background } from '@components/Background';
import { DrawingEditor } from '@client/entries/editor/_components/Editor';
import { context } from '@devvit/web/client';
import { getPostData } from '@client/utils/context';
import type { TournamentPostData } from '@shared/schema';
import { renderEntry } from '@client/entries/_render';

function App() {
  const postData = getPostData<TournamentPostData>();
  const isTournament =
    postData?.type === 'tournament' && Boolean(postData.word);

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
