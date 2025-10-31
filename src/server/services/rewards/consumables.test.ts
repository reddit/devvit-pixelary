import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getEffectiveScoreMultiplier,
  activateConsumable,
  getInventory,
} from './consumables';
import { redis } from '@devvit/web/server';

vi.mock('@devvit/web/server', () => ({
  redis: {
    hGetAll: vi.fn(),
    hIncrBy: vi.fn(),
    hSet: vi.fn(),
    expire: vi.fn(),
    zAdd: vi.fn(),
    zRange: vi.fn(),
    zRem: vi.fn(),
  },
}));

vi.mock('@server/core/redis', () => ({
  REDIS_KEYS: {
    userInventory: (userId: string) => `user:inventory:${userId}`,
    userActiveBoosts: (userId: string) => `user:active_boosts:${userId}`,
    boostActivation: (id: string) => `boost:${id}`,
  },
}));

describe('Consumables', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns highest active score multiplier (non-stacking)', async () => {
    vi.mocked(redis.zRange).mockResolvedValue([
      { member: 'act1', score: Date.now() + 10000 },
      { member: 'act2', score: Date.now() + 20000 },
    ] as never);
    vi.mocked(redis.hGetAll)
      .mockResolvedValueOnce({
        itemId: 'score_multiplier_2x_4h',
        expiresAt: String(Date.now() + 10000),
      } as never)
      .mockResolvedValueOnce({
        itemId: 'score_multiplier_3x_30m',
        expiresAt: String(Date.now() + 20000),
      } as never);

    const mult = await getEffectiveScoreMultiplier('t2_user' as never);
    expect(mult).toBe(3);
  });

  it('activateConsumable decrements inventory and tracks activation', async () => {
    vi.mocked(redis.hGetAll).mockResolvedValue({
      score_multiplier_2x_4h: '2',
    } as never);
    vi.mocked(redis.hIncrBy).mockResolvedValue(1 as never); // after decrement

    const result = await activateConsumable(
      't2_user' as never,
      'score_multiplier_2x_4h'
    );
    expect(result).not.toBeNull();
    expect(redis.hIncrBy).toHaveBeenCalled();
    expect(redis.hSet).toHaveBeenCalled();
    expect(redis.zAdd).toHaveBeenCalled();
  });

  it('getInventory returns empty when none', async () => {
    vi.mocked(redis.hGetAll).mockResolvedValue({} as never);
    const inv = await getInventory('t2_user' as never);
    expect(inv).toEqual({});
  });
});
