import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDrawingPairs } from './pairs';
import { redis } from '@devvit/web/server';
import { REDIS_KEYS } from '../redis';

vi.mock('@devvit/web/server', () => ({
  redis: {
    zRange: vi.fn(),
    hGetAll: vi.fn(),
  },
}));

describe('getDrawingPairs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns fair pairs without immediate repeats', async () => {
    const postId = 't3_post' as unknown as `t3_${string}`;
    const ids = ['t1_a', 't1_b', 't1_c', 't1_d', 't1_e'].map(
      (id) => id as unknown as `t1_${string}`
    );

    // Stub entries list
    (redis.zRange as unknown as vi.Mock).mockResolvedValueOnce(
      ids.map((member) => ({ member, score: 1000 }))
    );

    // Stub entry details
    (redis.hGetAll as unknown as vi.Mock).mockImplementation(
      async (key: string) => {
        if (
          key.startsWith(
            REDIS_KEYS.tournamentEntry('t1_' as unknown as `t1_${string}`)
          )
        ) {
          return {
            drawing: JSON.stringify({}),
            userId: 't2_user',
            postId: postId,
            mediaUrl: 'u',
            mediaId: 'm',
            votes: '0',
            views: '0',
          };
        }
        return {};
      }
    );

    const pairs = await getDrawingPairs(postId, 3);
    expect(pairs.length).toBe(3);
    for (let i = 1; i < pairs.length; i++) {
      const prev = pairs[i - 1]!.map((p) => p.commentId).join('|');
      const curr = pairs[i]!.map((p) => p.commentId).join('|');
      expect(curr).not.toBe(prev); // not identical consecutive pair
    }
  });
});
