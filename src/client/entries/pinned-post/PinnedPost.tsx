import { useState } from 'react';
import { MyDrawings } from './_components/MyDrawings';
import { Leaderboard } from './_components/Leaderboard';
import { MyRewards } from './_components/MyRewards';
import { LevelDetails } from './_components/LevelDetails';
import { Menu } from './_components/Menu';
import { trpc } from '@client/trpc/client';

type Page =
  | 'menu'
  | 'my-drawings'
  | 'leaderboard'
  | 'my-rewards'
  | 'level-details';

export function PinnedPost() {
  const [page, setPage] = useState<Page>('menu');
  const utils = trpc.useUtils();

  // Prefetch drawings optimistically for maximum performance
  trpc.app.user.getMyArtPage.useQuery(
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

  // Warm profile and bonuses so downstream views benefit from cache
  trpc.app.user.getProfile.useQuery(undefined, {
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
  trpc.app.rewards.getEffectiveBonuses.useQuery(undefined, {
    staleTime: 10000,
    refetchOnWindowFocus: false,
  });

  function handleClose() {
    setPage('menu');
  }

  function goToPage(page: Page) {
    if (page === 'my-rewards') {
      // Proactively load inventory/effects to avoid flashes in the modal
      void utils.app.rewards.getInventory.prefetch();
      void utils.app.rewards.getActiveEffects.prefetch();
    }
    setPage(page);
  }

  switch (page) {
    case 'menu':
      return (
        <Menu
          onMyDrawings={() => {
            goToPage('my-drawings');
          }}
          onLeaderboard={() => {
            goToPage('leaderboard');
          }}
          onHowToPlay={() => {
            goToPage('my-rewards');
          }}
          onLevelClick={() => {
            goToPage('level-details');
          }}
        />
      );
    case 'my-drawings':
      return <MyDrawings onClose={handleClose} />;
    case 'leaderboard':
      return <Leaderboard onClose={handleClose} />;
    case 'my-rewards':
      return <MyRewards onClose={handleClose} />;
    case 'level-details':
      return <LevelDetails onClose={handleClose} />;
    default:
      return null;
  }
}
