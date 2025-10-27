import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@devvit/web/server', () => ({
  redis: {
    zScore: vi.fn(),
    zAdd: vi.fn(),
    zIncrBy: vi.fn(),
    zRange: vi.fn(),
  },
  reddit: {
    getCommentById: vi.fn(),
  },
}));

import { redis } from '@devvit/web/server';
import { REDIS_KEYS } from './redis';
import { getEntryRating } from './tournament-post';
import { TOURNAMENT_ELO_INITIAL_RATING } from '../../shared/constants';

describe('Tournament Post Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEntryRating', () => {
    it('should return rating from Redis', async () => {
      const postId = 't3_test123';
      const commentId = 't1_test456';
      const expectedRating = 1250;

      vi.mocked(redis.zScore).mockResolvedValue(expectedRating);

      const rating = await getEntryRating(postId, commentId);

      expect(redis.zScore).toHaveBeenCalledWith(
        REDIS_KEYS.tournamentEntries(postId),
        commentId
      );
      expect(rating).toBe(expectedRating);
    });

    it('should return default rating when not found', async () => {
      const postId = 't3_test123';
      const commentId = 't1_test456';

      vi.mocked(redis.zScore).mockResolvedValue(null);

      const rating = await getEntryRating(postId, commentId);

      expect(rating).toBe(TOURNAMENT_ELO_INITIAL_RATING);
    });
  });
});
