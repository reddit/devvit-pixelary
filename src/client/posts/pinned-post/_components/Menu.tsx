import { LEVELS } from '../../../../shared/constants';
import type { Level } from '../../../../shared/types';
import { PixelFont } from '../../../components/PixelFont';
import { Counter } from '../../../components/Counter';
import { Button } from '../../../components/Button';
import { Logo } from '../../../components/Logo';
import { PixelSymbol } from '../../../components/PixelSymbol';
import { ProgressBar } from '../../../components/ProgressBar';
import { trpc } from '../../../trpc/client';

type MenuProps = {
  onDraw: () => void;
  onMyDrawings: () => void;
  onLeaderboard: () => void;
  onHowToPlay: () => void;
  onLevelClick: () => void;
};

export function Menu(props: MenuProps) {
  const { onDraw, onMyDrawings, onLeaderboard, onHowToPlay, onLevelClick } =
    props;

  const { data: userProfile } = trpc.app.user.getProfile.useQuery(undefined, {
    enabled: true,
  });
  const userLevel: Level | null = userProfile
    ? LEVELS.find((l) => l.rank === userProfile.level) || null
    : null;

  const progressPercentage =
    userLevel && userProfile
      ? ((userProfile.score - userLevel.min) /
          (userLevel.max - userLevel.min)) *
        100
      : 0;

  return (
    <main className="fixed inset-0 flex flex-col items-center justify-evenly min-h-screen px-4">
      {/* Logo + Wordmark */}
      <div className="flex flex-col items-center gap-4">
        <Logo size={64} />
        <PixelFont scale={4}>Pixelary</PixelFont>
      </div>

      {/* Featured Community Banner (if applicable) */}
      {/* This would be shown for special events like r/place takeover */}

      {/* Menu */}
      <nav className="flex flex-col gap-3 w-full max-w-3xs">
        <Button onClick={onDraw} size="medium">
          Draw
        </Button>

        <Button onClick={onMyDrawings} size="medium" variant="secondary">
          My drawings
        </Button>

        <Button onClick={onLeaderboard} size="medium" variant="secondary">
          Leaderboard
        </Button>

        <Button onClick={onHowToPlay} size="medium" variant="secondary">
          How to play
        </Button>
      </nav>

      {/* Experience Bar - Clickable */}
      <button
        onClick={onLevelClick}
        className="level-button hover:opacity-70 transition-opacity cursor-pointer flex flex-col items-center justify-center gap-2"
      >
        <div className="flex relative">
          <PixelFont scale={2}>Level </PixelFont>
          <Counter value={userLevel?.rank} scale={2} />
          <div className="absolute -right-5 level-arrow">
            <PixelSymbol
              type="arrow-right"
              scale={2}
              className="text-[var(--color-brand-tertiary)]"
            />
          </div>
        </div>

        <ProgressBar percentage={progressPercentage} width={200} height={8} />
      </button>
    </main>
  );
}
