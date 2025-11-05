import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getActivityDrawingTimeBonus, countUserPostsLast7d } from './activity';
import { redis } from '@devvit/web/server';
import { REDIS_KEYS } from '@server/core/redis';

vi.mock('@devvit/web/server', () => ({
  redis: {
    zRange: vi.fn(),
  },
}));

vi.mock('@server/core/redis', () => ({
  REDIS_KEYS: {
    userDrawings: (userId: string) => `user:drawings:${userId}`,
  },
}));

// Type-safe handle to mocked redis methods
const redisMock = redis as unknown as {
  zRange: ReturnType<typeof vi.fn>;
};

describe('Activity rewards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('counts posts in last 7 days using zRange filter', async () => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    redisMock.zRange.mockResolvedValue([
      { member: 'a', score: sevenDaysAgo - 1 },
      { member: 'b', score: sevenDaysAgo + 1 },
      { member: 'c', score: now - 1000 },
      { member: 'd', score: now + 1000 },
    ] as never);
    const count = await countUserPostsLast7d('t2_test' as never);
    expect(count).toBe(3);
    expect(redisMock.zRange).toHaveBeenCalledWith(
      REDIS_KEYS.userDrawings('t2_test' as never),
      0,
      -1,
      { by: 'rank' }
    );
  });

  it('grants +20s when posts_last_7d >= 10', async () => {
    const now = Date.now();
    const recentScore = now - 1000;
    redisMock.zRange.mockResolvedValue(
      Array.from({ length: 10 }).map((_, i) => ({
        member: `m${i}`,
        score: recentScore,
      })) as never
    );
    const bonus = await getActivityDrawingTimeBonus('t2_user' as never);
    expect(bonus.qualifies).toBe(true);
    expect(bonus.extraDrawingTimeSeconds).toBe(20);
  });

  it('grants 0s when below threshold', async () => {
    const now = Date.now();
    const recentScore = now - 1000;
    redisMock.zRange.mockResolvedValue(
      Array.from({ length: 7 }).map((_, i) => ({
        member: `m${i}`,
        score: recentScore,
      })) as never
    );
    const bonus = await getActivityDrawingTimeBonus('t2_user' as never);
    expect(bonus.qualifies).toBe(false);
    expect(bonus.extraDrawingTimeSeconds).toBe(0);
  });
});
