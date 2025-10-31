import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getActivityDrawingTimeBonus, countUserPostsLast7d } from './activity';
import { redis } from '@devvit/web/server';
import { REDIS_KEYS } from '@server/core/redis';

vi.mock('@devvit/web/server', () => ({
  redis: {
    zCount: vi.fn(),
    zRange: vi.fn(),
  },
}));

vi.mock('@server/core/redis', () => ({
  REDIS_KEYS: {
    userDrawings: (userId: string) => `user:drawings:${userId}`,
  },
}));

describe('Activity rewards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('counts posts in last 7 days using zCount', async () => {
    vi.mocked(redis.zCount).mockResolvedValue(12 as never);
    const count = await countUserPostsLast7d('t2_test' as never);
    expect(count).toBe(12);
    expect(redis.zCount).toHaveBeenCalledWith(
      REDIS_KEYS.userDrawings('t2_test' as never),
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('grants +20s when posts_last_7d >= 10', async () => {
    vi.mocked(redis.zCount).mockResolvedValue(10 as never);
    const bonus = await getActivityDrawingTimeBonus('t2_user' as never);
    expect(bonus.qualifies).toBe(true);
    expect(bonus.extraDrawingTimeSeconds).toBe(20);
  });

  it('grants 0s when below threshold', async () => {
    vi.mocked(redis.zCount).mockResolvedValue(7 as never);
    const bonus = await getActivityDrawingTimeBonus('t2_user' as never);
    expect(bonus.qualifies).toBe(false);
    expect(bonus.extraDrawingTimeSeconds).toBe(0);
  });
});
