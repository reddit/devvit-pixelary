import { Text, Icon } from '@components/PixelFont';
// Removed animated counter to avoid stale/blank states
import { Button } from '@components/Button';
import { Logo } from '@components/Logo';
import { ProgressBar } from '@components/ProgressBar';
import { trpc } from '@client/trpc/client';
import { useTelemetry } from '@client/hooks/useTelemetry';
import { useEffect, useRef } from 'react';
import { ActiveEffectsBadge } from '@components/ActiveEffectsBadge';
import {
  requestExpandedMode,
  showLoginPrompt,
  addWebViewModeListener,
  removeWebViewModeListener,
  navigateTo,
  context,
} from '@devvit/web/client';

type MenuProps = {
  onMyDrawings: () => void;
  onLeaderboard: () => void;
  onHowToPlay: () => void;
  onLevelClick: () => void;
};

export function Menu(props: MenuProps) {
  const { onMyDrawings, onLeaderboard, onHowToPlay, onLevelClick } = props;
  const isLoggedIn = Boolean(context.userId);
  const contextLoid =
    (context as typeof context & { loid?: string | null }).loid ?? null;

  // Telemetry
  const { track } = useTelemetry();
  const utils = trpc.useUtils();
  useEffect(() => {
    void track('view_menu');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Grab data
  const { data: userProfile } = trpc.app.user.getProfile.useQuery(
    contextLoid ? { loid: contextLoid } : undefined,
    {
      enabled: true,
    }
  );

  // Check if user is admin
  const { data: isUserAdmin } = trpc.app.user.isAdmin.useQuery(undefined, {
    enabled: true,
  });

  // Warm editor-related caches as soon as the menu is visible
  useEffect(() => {
    void utils.app.user.getProfile.prefetch(
      contextLoid ? { loid: contextLoid } : undefined
    );
    void utils.app.rewards.getEffectiveBonuses.prefetch();
    void utils.app.user.colors.getRecent.prefetch();
    void utils.app.dictionary.getCandidates.prefetch();
  }, [contextLoid, utils]);

  // Get progress percentage from user profile
  const progressPercentage = userProfile?.levelProgressPercentage ?? 0;

  const getPendingNavigation = trpc.app.user.getPendingNavigation.useMutation();
  const navigationInProgressRef = useRef(false);

  useEffect(() => {
    if (!context.userId) return;

    const listener = (mode: 'inline' | 'expanded') => {
      if (mode === 'inline' && !navigationInProgressRef.current) {
        navigationInProgressRef.current = true;
        void (async () => {
          try {
            const result = await getPendingNavigation.mutateAsync();
            if (result.url) {
              navigateTo(result.url);
            }
          } finally {
            // Reset after a short delay to allow navigation to complete
            setTimeout(() => {
              navigationInProgressRef.current = false;
            }, 1000);
          }
        })();
      }
    };
    addWebViewModeListener(listener);
    return () => {
      removeWebViewModeListener(listener);
    };
  }, [getPendingNavigation]);

  return (
    <main className="absolute inset-0 flex flex-col items-center justify-evenly min-h-screen px-4">
      <ActiveEffectsBadge />
      {/* Logo + Wordmark */}
      <div className="flex flex-col items-center gap-4">
        {isUserAdmin ? (
          <button
            onClick={async (e) => {
              void requestExpandedMode(e, 'analytics');
            }}
            className="cursor-default"
            type="button"
          >
            <Logo size={64} />
          </button>
        ) : (
          <Logo size={64} />
        )}
        <Text scale={4}>Pixelary</Text>
      </div>

      {/* Featured Community Banner (if applicable) */}
      {/* This would be shown for special events like r/place takeover */}

      {/* Menu */}
      <nav className="flex flex-col gap-3 w-full max-w-3xs">
        <Button
          onClick={(e) => {
            if (!isLoggedIn) {
              showLoginPrompt();
              return;
            }
            void requestExpandedMode(e, 'editor');
          }}
          size="large"
          telemetryEvent={isLoggedIn ? 'click_draw' : 'click_log_in'}
        >
          {isLoggedIn ? 'Draw' : 'Log in to draw'}
        </Button>

        {isLoggedIn && (
          <Button
            onClick={onMyDrawings}
            size="medium"
            variant="secondary"
            telemetryEvent="click_my_drawings"
          >
            My Drawings
          </Button>
        )}

        {isLoggedIn && (
          <Button
            onClick={onHowToPlay}
            size="medium"
            variant="secondary"
            telemetryEvent="click_my_rewards"
          >
            My Rewards
          </Button>
        )}

        <Button
          onClick={onLeaderboard}
          size="medium"
          variant="secondary"
          telemetryEvent="click_leaderboard"
        >
          Leaderboard
        </Button>
      </nav>

      {/* Experience Bar - Clickable */}
      <button
        onClick={() => {
          void track('click_level_details');
          onLevelClick();
        }}
        className="level-button hover:opacity-70 transition-opacity cursor-pointer flex flex-col items-center justify-center gap-2"
      >
        <div className="flex relative">
          <Text>{`Level ${userProfile?.level ?? 0}`}</Text>
          <div className="absolute -right-5 level-arrow">
            <Icon type="arrow-right" className="text-tertiary" />
          </div>
        </div>

        <ProgressBar percentage={progressPercentage} width={200} height={8} />
      </button>
    </main>
  );
}
