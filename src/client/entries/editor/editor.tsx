import React from 'react';
import ReactDOM from 'react-dom/client';

import { Providers } from '@components/Providers';
import { Background } from '@components/Background';
import { DrawingEditor } from '@client/entries/editor/_components/Editor';
import { context } from '@devvit/web/client';
import { getPostData } from '@client/utils/context';
import type { TournamentPostData } from '@shared/schema';

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
          tournamentWord={postData?.word ?? ''}
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

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Providers>
      <App />
    </Providers>
  </React.StrictMode>
);
