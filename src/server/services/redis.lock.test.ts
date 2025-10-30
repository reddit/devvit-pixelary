import { describe, it, expect, vi, beforeEach } from 'vitest';
import { acquireLock, releaseLock, REDIS_KEYS } from './redis';
import { redis } from '@devvit/web/server';

vi.mock('@devvit/web/server', () => ({
  redis: {
    set: vi.fn(),
    del: vi.fn(),
    expire: vi.fn(),
  },
}));

describe('acquireLock/releaseLock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('acquires lock with NX EX and releases it', async () => {
    (redis.set as unknown as vi.Mock).mockResolvedValueOnce('OK');

    const key = REDIS_KEYS.commentUpdateLock(
      't3_post' as unknown as `t3_${string}`
    );
    const ok = await acquireLock(key, 30);
    expect(ok).toBe(true);
    expect(redis.set).toHaveBeenCalledWith(
      key,
      '1',
      expect.objectContaining({ ex: 30, nx: true })
    );

    await releaseLock(key);
    expect(redis.del).toHaveBeenCalledWith(key);
  });

  it('returns false if lock is held', async () => {
    (redis.set as unknown as vi.Mock).mockResolvedValueOnce(null);

    const key = REDIS_KEYS.commentUpdateLock(
      't3_post' as unknown as `t3_${string}`
    );
    const ok = await acquireLock(key, 30);
    expect(ok).toBe(false);
  });
});
