import { trpc } from '../../../trpc/client';
import { abbreviateNumber } from '../../../../shared/utils/math';
import { PixelFont } from '../../../components/PixelFont';
import { CardLayout } from './CardLayout';
import { PixelSymbol } from '@src/client/components/PixelSymbol';
import type { LeaderboardEntry } from '../../../../shared/schema/index';

interface LeaderboardProps {
  onClose: () => void;
}

export function Leaderboard({ onClose }: LeaderboardProps) {
  const { data: leaderboard = [], isLoading } =
    trpc.app.leaderboard.getTop.useQuery({ limit: 10 });
  const { data: userRank } = trpc.app.user.getRank.useQuery();

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h2 className="font-pixel text-pixel-text-scale-3">Leaderboard</h2>
        </div>
        <div className="space-y-2"></div>
      </div>
    );
  }

  return (
    <CardLayout title="Leaderboard" onClose={onClose}>
      {/* Top 10 */}
      <div className="h-full w-full flex flex-col">
        {leaderboard.map((player: LeaderboardEntry, index: number) => (
          <LeaderboardRow
            key={index}
            rank={index + 1}
            username={player.username}
            score={player.score}
          />
        ))}
        {/* Current User */}
        {userRank && userRank.rank > 0 && (
          <LeaderboardRow
            rank={userRank.rank}
            username={userRank.username}
            score={userRank.score}
            className="border-t-2 border-t-[var(--color-brand-tertiary)]"
          />
        )}
      </div>
    </CardLayout>
  );
}

/*
 * Leaderboard Row
 */

interface LeaderboardRowProps {
  rank: number;
  username: string;
  score: number;
  onClick?: () => void;
  className?: string;
}

function LeaderboardRow({
  rank,
  username,
  score,
  onClick,
  className = '',
}: LeaderboardRowProps) {
  return (
    <button
      className={`w-full h-1/10 flex items-center justify-start ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {/* Rank + Username */}
      <div className="flex items-center gap-2 w-full flex-1 justify-start overflow-hidden">
        <PixelFont className="text-[var(--color-brand-secondary)]">
          {`${rank}.`}
        </PixelFont>
        <PixelFont>{username}</PixelFont>
      </div>

      {/* Score */}
      <div className="flex items-center gap-2 text-[var(--color-brand-secondary)]">
        <PixelFont>{abbreviateNumber(score)}</PixelFont>
        <PixelSymbol type="star" />
      </div>
    </button>
  );
}
