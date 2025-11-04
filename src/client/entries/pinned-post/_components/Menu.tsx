import { Text, Icon } from '@components/PixelFont';
import { Counter } from '@components/Counter';
import { Button } from '@components/Button';
import { Logo } from '@components/Logo';
import { ProgressBar } from '@components/ProgressBar';
import { trpc } from '@client/trpc/client';
import { useTelemetry } from '@client/hooks/useTelemetry';
import { useEffect } from 'react';
import { ActiveEffectsBadge } from '@components/ActiveEffectsBadge';
import { requestExpandedMode } from '@devvit/web/client';

type MenuProps = {
  onMyDrawings: () => void;
  onLeaderboard: () => void;
  onHowToPlay: () => void;
  onLevelClick: () => void;
};

export function Menu(props: MenuProps) {
  const { onMyDrawings, onLeaderboard, onHowToPlay, onLevelClick } = props;

  // Telemetry
  const { track } = useTelemetry();
  useEffect(() => {
    void track('view_menu');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Grab data
  const { data: userProfile } = trpc.app.user.getProfile.useQuery(undefined, {
    enabled: true,
  });

  // Get progress percentage from user profile
  const progressPercentage = userProfile?.levelProgressPercentage ?? 0;

  return (
    <main className="absolute inset-0 flex flex-col items-center justify-evenly min-h-screen px-4">
      <ActiveEffectsBadge />
      {/* Logo + Wordmark */}
      <div className="flex flex-col items-center gap-4">
        <Logo size={64} />
        <Text scale={4}>Pixelary</Text>
      </div>

      {/* Featured Community Banner (if applicable) */}
      {/* This would be shown for special events like r/place takeover */}

      {/* Menu */}
      <nav className="flex flex-col gap-3 w-full max-w-3xs">
        <Button
          onNativeClick={(e) => {
            void requestExpandedMode(
              e.nativeEvent as unknown as MouseEvent,
              'editor'
            );
          }}
          size="large"
          telemetryEvent="click_draw"
        >
          Draw
        </Button>

        <Button
          onClick={onMyDrawings}
          size="medium"
          variant="secondary"
          telemetryEvent="click_my_drawings"
        >
          My Drawings
        </Button>

        <Button
          onClick={onHowToPlay}
          size="medium"
          variant="secondary"
          telemetryEvent="click_my_rewards"
        >
          My Rewards
        </Button>

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
          <Text scale={2}>Level </Text>
          <Counter value={userProfile?.level} scale={2} />
          <div className="absolute -right-5 level-arrow">
            <Icon type="arrow-right" scale={2} className="text-tertiary" />
          </div>
        </div>

        <ProgressBar percentage={progressPercentage} width={200} height={8} />
      </button>
    </main>
  );
}
