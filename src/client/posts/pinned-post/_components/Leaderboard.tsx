import { trpc } from '@client/trpc/client';
import { abbreviateNumber } from '@shared/utils/numbers';
import { Text, Icon } from '@components/PixelFont';
import { CardLayout } from './CardLayout';
import type { LeaderboardEntry } from '@shared/schema/index';
import { useTelemetry } from '@client/hooks/useTelemetry';
import { useEffect } from 'react';

interface LeaderboardProps {
  onClose: () => void;
}

export function Leaderboard({ onClose }: LeaderboardProps) {
  // Telemetry
  const { track } = useTelemetry();
  useEffect(() => {
    void track('view_leaderboard');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Grab data
  const { data: leaderboard = [], isLoading } =
    trpc.app.leaderboard.getTop.useQuery({ limit: 10 });
  const { data: userRank } = trpc.app.user.getRank.useQuery();

  return (
    <CardLayout title="Leaderboard" onClose={onClose}>
      {/* Top 10 */}
      <div className="h-full w-full flex flex-col">
        {isLoading && leaderboard.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Text>Loading...</Text>
          </div>
        ) : (
          <>
            {leaderboard.map((player: LeaderboardEntry, index: number) => (
              <LeaderboardRow
                key={index}
                rank={index + 1}
                username={player.username}
                score={player.score}
              />
            ))}
            {/* Current User - only show if not in top N */}
            {userRank && userRank.rank > leaderboard.length && (
              <LeaderboardRow
                rank={userRank.rank}
                username={userRank.username}
                score={userRank.score}
                className="border-t-2 border-t-tertiary"
              />
            )}
          </>
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
        <Text className="text-secondary">{`${rank}.`}</Text>
        <Text>{username}</Text>
      </div>

      {/* Score */}
      <div className="flex items-center gap-2 text-secondary">
        <Text>{abbreviateNumber(score)}</Text>
        <Icon type="star" />
      </div>
    </button>
  );
}
