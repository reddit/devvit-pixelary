import type { T1, T3 } from '@devvit/shared-types/tid.js';
import { redis } from '@devvit/web/server';
import { REDIS_KEYS } from '@server/core/redis';
import {
  TOURNAMENT_PAYOUT_LADDER_FIRST,
  TOURNAMENT_PAYOUT_LADDER_SECOND,
  TOURNAMENT_PAYOUT_LADDER_THIRD,
  TOURNAMENT_PAYOUT_REWARD_TOP_PERCENT,
  TOURNAMENT_PAYOUT_TOP_PERCENT,
} from '@shared/constants';
import { incrementScore } from '@server/services/progression';
import { getTournamentEntry } from './post';
import { buildTournamentPayoutSummary } from './summary';

/**
 * Awards per-snapshot tournament rewards using current ELO standings.
 * - Pays a base amount to top N% (min 1)
 * - Adds ladder bonuses for ranks 1, 2, and 3
 */
export async function awardTournamentRewards(
  postId: T3,
  options?: { manual?: boolean; dayIndex?: number }
): Promise<{ summary: string }> {
  const entryCount = await redis.zCard(REDIS_KEYS.tournamentEntries(postId));
  if (entryCount === 0) {
    return {
      summary: options?.manual ? 'Manual payout executed.' : 'Payout executed.',
    };
  }

  const percent = Math.max(0, Math.min(100, TOURNAMENT_PAYOUT_TOP_PERCENT));
  const cutoff = Math.max(1, Math.floor((entryCount * percent) / 100));

  const entries = await redis.zRange(
    REDIS_KEYS.tournamentEntries(postId),
    0,
    cutoff - 1,
    { by: 'score', reverse: true }
  );

  const entryData = await Promise.all(
    entries.map(async (entry) => await getTournamentEntry(entry.member as T1))
  );

  const rewardPromises: Promise<unknown>[] = [];
  for (let i = 0; i < cutoff; i++) {
    const score = entries[i];
    const data = entryData[i];
    if (!score || !data) continue;
    const userId = data.userId;

    if (TOURNAMENT_PAYOUT_REWARD_TOP_PERCENT > 0) {
      rewardPromises.push(
        incrementScore(userId, TOURNAMENT_PAYOUT_REWARD_TOP_PERCENT)
      );
    }

    if (i === 0 && TOURNAMENT_PAYOUT_LADDER_FIRST > 0) {
      rewardPromises.push(
        incrementScore(userId, TOURNAMENT_PAYOUT_LADDER_FIRST)
      );
    } else if (i === 1 && TOURNAMENT_PAYOUT_LADDER_SECOND > 0) {
      rewardPromises.push(
        incrementScore(userId, TOURNAMENT_PAYOUT_LADDER_SECOND)
      );
    } else if (i === 2 && TOURNAMENT_PAYOUT_LADDER_THIRD > 0) {
      rewardPromises.push(
        incrementScore(userId, TOURNAMENT_PAYOUT_LADDER_THIRD)
      );
    }
  }

  await Promise.all(rewardPromises);

  const summary = await buildTournamentPayoutSummary(postId, options);
  return { summary };
}
