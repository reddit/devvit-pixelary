import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@devvit/web/server', () => ({
  reddit: {
    getUserByUsername: vi.fn(),
  },
  redis: {
    global: {
      zAdd: vi.fn(),
      zRem: vi.fn(),
      zCard: vi.fn(),
      zScore: vi.fn(),
    },
  },
}));

import { redis, reddit } from '@devvit/web/server';
import { REDIS_KEYS } from '../core/redis';
import {
  getLegacyUsersCount,
  isLegacyUser,
  addLegacyUsers,
  removeLegacyUsers,
} from './legacy';
import { resolveUsernamesToIds } from '../core/user';

describe('Legacy Users Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gets legacy users count', async () => {
    vi.mocked(redis.global.zCard).mockResolvedValue(42);
    const count = await getLegacyUsersCount();
    expect(count).toBe(42);
    expect(redis.global.zCard).toHaveBeenCalledWith(REDIS_KEYS.legacyUsers());
  });

  it('checks legacy membership', async () => {
    vi.mocked(redis.global.zScore).mockResolvedValueOnce(123456789);
    const yes = await isLegacyUser('t2_user' as never);
    expect(yes).toBe(true);

    vi.mocked(redis.global.zScore).mockResolvedValueOnce(undefined as never);
    const no = await isLegacyUser('t2_other' as never);
    expect(no).toBe(false);
  });

  it('adds legacy users', async () => {
    vi.mocked(redis.global.zAdd).mockResolvedValue(3);
    const added = await addLegacyUsers([
      't2_a' as never,
      't2_b' as never,
      't2_c' as never,
    ]);
    expect(added).toBe(3);
    expect(redis.global.zAdd).toHaveBeenCalled();
  });

  it('removes legacy users', async () => {
    vi.mocked(redis.global.zRem).mockResolvedValue(2);
    const removed = await removeLegacyUsers(['t2_a' as never, 't2_b' as never]);
    expect(removed).toBe(2);
    expect(redis.global.zRem).toHaveBeenCalledWith(REDIS_KEYS.legacyUsers(), [
      't2_a',
      't2_b',
    ]);
  });

  it('resolves usernames to IDs', async () => {
    vi.mocked(reddit.getUserByUsername)
      .mockResolvedValueOnce({ id: 't2_a' } as never)
      .mockResolvedValueOnce({ id: 't2_b' } as never)
      .mockResolvedValueOnce(null as never);

    const ids = await resolveUsernamesToIds(['u/Foo', 'Bar', 'baz']);
    expect(ids).toEqual(['t2_a', 't2_b']);
    expect(reddit.getUserByUsername).toHaveBeenCalledWith('u/Foo');
    expect(reddit.getUserByUsername).toHaveBeenCalledWith('Bar');
    expect(reddit.getUserByUsername).toHaveBeenCalledWith('baz');
  });

  // "ByUsernames" helpers removed; logic is inlined at call sites
});
