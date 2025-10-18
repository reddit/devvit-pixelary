import { useState } from 'react';
import { DrawingEditor } from '../../components/Editor/Editor';
import { MyDrawings } from './_components/MyDrawings';
import { Leaderboard } from './_components/Leaderboard';
import { HowToPlay } from './_components/HowToPlay';
import { LevelDetails } from './_components/LevelDetails';
import { Menu } from './_components/Menu';
import { trpc } from '../../trpc/client';

type Page =
  | 'menu'
  | 'drawing'
  | 'my-drawings'
  | 'leaderboard'
  | 'how-to-play'
  | 'level-details';

export function PinnedPost() {
  const [page, setPage] = useState<Page>('menu');

  const { data: isModerator = false } = trpc.app.user.isModerator.useQuery();

  // Prefetch drawings optimistically for maximum performance
  trpc.app.user.getDrawings.useQuery(
    { limit: 20 },
    {
      staleTime: 60000, // Cache for 1 minute
      refetchOnWindowFocus: false, // Don't refetch on window focus
    }
  );

  // Prefetch leaderboard data for instant loading
  trpc.app.leaderboard.getTop.useQuery(
    { limit: 10 },
    {
      staleTime: 60000, // Cache for 1 minute
      refetchOnWindowFocus: false, // Don't refetch on window focus
    }
  );

  function handleClose() {
    setPage('menu');
  }

  function goToPage(page: Page) {
    setPage(page);
  }

  switch (page) {
    case 'menu':
      return (
        <Menu
          onDraw={() => goToPage('drawing')}
          onMyDrawings={() => goToPage('my-drawings')}
          onLeaderboard={() => goToPage('leaderboard')}
          onHowToPlay={() => goToPage('how-to-play')}
          onLevelClick={() => goToPage('level-details')}
          isModerator={isModerator}
        />
      );
    case 'drawing':
      return <DrawingEditor onClose={handleClose} />;
    case 'my-drawings':
      return <MyDrawings onClose={handleClose} />;
    case 'leaderboard':
      return <Leaderboard onClose={handleClose} />;
    case 'how-to-play':
      return <HowToPlay onClose={handleClose} />;
    case 'level-details':
      return <LevelDetails onClose={handleClose} />;
    default:
      return null;
  }
}
