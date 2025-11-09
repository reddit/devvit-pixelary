import { describe, it, expect, beforeEach, vi } from 'vitest';
import { redis } from '@devvit/web/server';
import { REDIS_KEYS } from '@server/core/redis';
import { getMyArtPage } from './user-art';

const userId = 't2_testuser' as `t2_${string}`;

describe('user-art service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('merges and sorts items by createdAt with pagination metadata', async () => {
    // Arrange zset page (scores are createdAt)
    (redis.zRange as unknown as vi.Mock).mockResolvedValue([
      { member: 'd:postA', score: 2000 },
      { member: 't:commB', score: 1500 },
      { member: 'd:postC', score: 1000 },
    ]);
    (redis.zCard as unknown as vi.Mock).mockResolvedValue(3);

    // Snapshot reads should be empty to trigger hydration
    (redis.hGetAll as unknown as vi.Mock).mockImplementation(
      async (key: string) => {
        // drawing source
        if (key === REDIS_KEYS.drawing('postA' as never)) {
          return {
            drawing: JSON.stringify({
              data: '',
              colors: [],
              bg: 0,
              size: 16,
            }),
            createdAt: '2000',
          };
        }
        if (key === REDIS_KEYS.drawing('postC' as never)) {
          return {
            drawing: JSON.stringify({
              data: '',
              colors: [],
              bg: 0,
              size: 16,
            }),
            createdAt: '1000',
          };
        }
        // tournament entry source
        if (key === REDIS_KEYS.tournamentEntry('commB' as never)) {
          return {
            drawing: JSON.stringify({
              data: '',
              colors: [],
              bg: 0,
              size: 16,
            }),
            userId,
            postId: 't3_tourn' as never,
            mediaUrl: 'u',
            mediaId: 'm',
            votes: '0',
            views: '0',
            createdAt: '1500',
          };
        }
        // snapshots miss
        if (
          key === REDIS_KEYS.userArtItem(userId, 'd:postA') ||
          key === REDIS_KEYS.userArtItem(userId, 't:commB') ||
          key === REDIS_KEYS.userArtItem(userId, 'd:postC')
        ) {
          return {};
        }
        return {};
      }
    );

    // Act
    const { items, nextCursor } = await getMyArtPage({
      userId,
      limit: 2,
      cursor: 0,
    });

    // Assert
    expect(items).toHaveLength(2);
    expect(items[0]?.id).toBe('d:postA');
    expect(items[1]?.id).toBe('t:commB');
    expect(nextCursor).toBe(2);
  });

  it('backfills snapshot on hydration (hSet called)', async () => {
    (redis.zRange as unknown as vi.Mock).mockResolvedValue([
      { member: 'd:postOnly', score: 1111 },
    ]);
    (redis.zCard as unknown as vi.Mock).mockResolvedValue(1);
    (redis.hGetAll as unknown as vi.Mock).mockImplementation(
      async (key: string) => {
        if (key === REDIS_KEYS.userArtItem(userId, 'd:postOnly')) return {};
        if (key === REDIS_KEYS.drawing('postOnly' as never)) {
          return {
            drawing: JSON.stringify({
              data: '',
              colors: [],
              bg: 0,
              size: 16,
            }),
          };
        }
        return {};
      }
    );
    (redis.hSet as unknown as vi.Mock).mockResolvedValue(undefined);

    const res = await getMyArtPage({ userId, limit: 1 });
    expect(res.items).toHaveLength(1);
    const calls = (redis.hSet as unknown as vi.Mock).mock.calls;
    const wroteSnapshot = calls.some((args) =>
      String(args[0]).includes(REDIS_KEYS.userArtItem(userId, 'd:postOnly'))
    );
    expect(wroteSnapshot).toBe(true);
  });
});
