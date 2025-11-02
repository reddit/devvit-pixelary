import type { T1, T3 } from '@devvit/shared-types/tid.js';
import { REDIS_KEYS } from '@server/core/redis';
import { getTournamentEntry } from '@server/services/posts/tournament/post';
import { getUsername } from '@server/core/user';
import {
  TOURNAMENT_PAYOUT_SNAPSHOT_COUNT,
  TOURNAMENT_PAYOUT_TOP_PERCENT,
  TOURNAMENT_PAYOUT_REWARD_TOP_PERCENT,
  TOURNAMENT_PAYOUT_LADDER_FIRST,
  TOURNAMENT_PAYOUT_LADDER_SECOND,
  TOURNAMENT_PAYOUT_LADDER_THIRD,
} from '@shared/constants';

export async function buildTournamentPayoutSummary(
  postId: T3,
  options?: { dayIndex?: number; manual?: boolean }
): Promise<string> {
  let entryCount = 0;
  let entries: { member: string; score: number }[] = [];
  try {
    const { redis } = await import('@devvit/web/server');
    entryCount = await redis.zCard(REDIS_KEYS.tournamentEntries(postId));
    entries = await redis.zRange(REDIS_KEYS.tournamentEntries(postId), 0, -1, {
      by: 'score',
      reverse: true,
    });
  } catch {
    return options?.manual ? 'Manual payout executed.' : 'Payout executed.';
  }

  const percent = Math.max(0, Math.min(100, TOURNAMENT_PAYOUT_TOP_PERCENT));
  const cutoff = Math.max(1, Math.floor((entryCount * percent) / 100));
  const entryData = await Promise.all(
    entries.slice(0, cutoff).map(async (e) => getTournamentEntry(e.member as T1))
  );
  const top3 = entryData
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
    .slice(0, 3);
  const names = await Promise.all(top3.map((d) => getUsername(d.userId)));

  const parts: string[] = [];
  if (options?.manual) {
    parts.push(`Manual payout: paid top ${percent}% (${cutoff})`);
  } else if (options?.dayIndex) {
    parts.push(
      `Day ${options.dayIndex}/${TOURNAMENT_PAYOUT_SNAPSHOT_COUNT}: paid top ${percent}% (${cutoff})`
    );
  } else {
    parts.push(`Payout: paid top ${percent}% (${cutoff})`);
  }
  if (TOURNAMENT_PAYOUT_REWARD_TOP_PERCENT > 0) {
    parts.push(` +${TOURNAMENT_PAYOUT_REWARD_TOP_PERCENT} each`);
  }
  if (names[0] && TOURNAMENT_PAYOUT_LADDER_FIRST > 0)
    parts.push(` | 1st +${TOURNAMENT_PAYOUT_LADDER_FIRST} (u/${names[0]})`);
  if (names[1] && TOURNAMENT_PAYOUT_LADDER_SECOND > 0)
    parts.push(`, 2nd +${TOURNAMENT_PAYOUT_LADDER_SECOND} (u/${names[1]})`);
  if (names[2] && TOURNAMENT_PAYOUT_LADDER_THIRD > 0)
    parts.push(`, 3rd +${TOURNAMENT_PAYOUT_LADDER_THIRD} (u/${names[2]})`);

  return parts.join('');
}
