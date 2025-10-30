import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isRateLimited } from './redis';
import { redis } from '@devvit/web/server';

vi.mock('@devvit/web/server', () => ({
  redis: {
    incrBy: vi.fn(),
    expire: vi.fn(),
  },
}));

describe('isRateLimited', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('limits after threshold and sets TTL on first increment', async () => {
    // First call returns 1 => not limited, sets TTL
    (redis.incrBy as unknown as vi.Mock).mockResolvedValueOnce(1);
    const limited1 = await isRateLimited('rate:test', 3, 1);
    expect(limited1).toBe(false);
    expect(redis.expire).toHaveBeenCalled();

    // Next calls: 2, 3, 4 => limited on 4th
    (redis.incrBy as unknown as vi.Mock).mockResolvedValueOnce(2);
    const limited2 = await isRateLimited('rate:test', 3, 1);
    expect(limited2).toBe(false);
    (redis.incrBy as unknown as vi.Mock).mockResolvedValueOnce(3);
    const limited3 = await isRateLimited('rate:test', 3, 1);
    expect(limited3).toBe(false);
    (redis.incrBy as unknown as vi.Mock).mockResolvedValueOnce(4);
    const limited4 = await isRateLimited('rate:test', 3, 1);
    expect(limited4).toBe(true);
  });
});
