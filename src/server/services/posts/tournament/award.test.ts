import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@devvit/web/server', () => ({
  redis: {
    zCard: vi.fn(),
    zRange: vi.fn(),
    hGetAll: vi.fn(),
  },
  reddit: {
    submitComment: vi.fn(),
  },
}));

vi.mock('@server/services/progression', () => ({
  incrementScore: vi.fn(),
}));

import { redis } from '@devvit/web/server';
import type { T3 } from '@devvit/shared-types/tid.js';
import { awardTournamentRewards } from './award';
import { incrementScore } from '@server/services/progression';
import {
  TOURNAMENT_PAYOUT_REWARD_TOP_PERCENT,
  TOURNAMENT_PAYOUT_LADDER_FIRST,
  TOURNAMENT_PAYOUT_LADDER_SECOND,
} from '@shared/constants';

describe('awardTournamentRewards (snapshot engine)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('awards top-% base reward and ladder bonuses', async () => {
    vi.mocked(redis.zCard).mockResolvedValue(10);
    vi.mocked(redis.zRange).mockResolvedValue([
      { member: 't1_a', score: 1600 },
      { member: 't1_b', score: 1500 },
      { member: 't1_c', score: 1400 },
      { member: 't1_d', score: 1300 },
    ] as unknown as Array<{ member: string; score: number }>);
    // getTournamentEntry is called via hGetAll path in module; mock hGetAll
    vi.mocked(redis.hGetAll).mockImplementation(async (key: string) => {
      const id = String(key).split(':').pop()!;
      return {
        drawing: JSON.stringify({}),
        userId: `t2_${id}`,
        postId: 't3_x',
        mediaUrl: 'u',
        mediaId: 'm',
        votes: '0',
        views: '0',
      } as unknown as Record<string, string>;
    });

    await awardTournamentRewards('t3_x' as T3);

    // cutoff 20% of 10 = 2 → users for t1_a, t1_b
    const calls = vi.mocked(incrementScore).mock.calls;
    // Expect base rewards for both top 2
    expect(
      calls.some(
        (c) =>
          c[0]?.startsWith('t2_t1_a') &&
          c[1] === TOURNAMENT_PAYOUT_REWARD_TOP_PERCENT
      )
    ).toBe(true);
    expect(
      calls.some(
        (c) =>
          c[0]?.startsWith('t2_t1_b') &&
          c[1] === TOURNAMENT_PAYOUT_REWARD_TOP_PERCENT
      )
    ).toBe(true);
    // Ladder bonuses
    expect(
      calls.some(
        (c) =>
          c[0]?.startsWith('t2_t1_a') && c[1] === TOURNAMENT_PAYOUT_LADDER_FIRST
      )
    ).toBe(true);
    expect(
      calls.some(
        (c) =>
          c[0]?.startsWith('t2_t1_b') &&
          c[1] === TOURNAMENT_PAYOUT_LADDER_SECOND
      )
    ).toBe(true);
  });
});
