import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getLeaderboard,
  getScore,
  incrementScore,
  getLevelByScore,
  getUserLevel,
  getRank,
} from './progression';
import { redis, scheduler, cache } from '@devvit/web/server';
import { LEVELS } from '../../shared/constants';
import { getUsername, REDIS_KEYS } from './redis';

vi.mock('@devvit/web/server', () => ({
  redis: {
    zRange: vi.fn(),
    zScore: vi.fn(),
    zIncrBy: vi.fn(),
    zRank: vi.fn(),
  },
  scheduler: {
    runJob: vi.fn(),
  },
  cache: vi.fn((fn) => fn()),
  context: {
    subredditName: 'testsubreddit',
  },
}));

vi.mock('./redis', () => ({
  getUsername: vi.fn(),
  REDIS_KEYS: {
    scores: () => 'scores',
  },
}));

describe('Leaderboard Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all mocks to their default behavior
    vi.mocked(redis.zRange).mockClear();
    vi.mocked(redis.zScore).mockClear();
    vi.mocked(redis.zIncrBy).mockClear();
    vi.mocked(redis.zRank).mockClear();
    vi.mocked(scheduler.runJob).mockClear();
    vi.mocked(getUsername).mockClear();
  });

  describe('getLeaderboard', () => {
    it('returns leaderboard entries', async () => {
      vi.mocked(redis.zRange).mockResolvedValue([
        { member: 't2_user1', score: 1000 },
        { member: 't2_user2', score: 800 },
        { member: 't2_user3', score: 600 },
      ]);
      vi.mocked(getUsername)
        .mockResolvedValueOnce('testuser1')
        .mockResolvedValueOnce('testuser2')
        .mockResolvedValueOnce('testuser3');

      const result = await getLeaderboard({ limit: 3 });

      expect(result.entries).toHaveLength(3);
      expect(result.entries[0]).toEqual({
        username: 'testuser1',
        userId: 't2_user1',
        score: 1000,
        rank: 1,
      });
      expect(result.nextCursor).toBe(3);
    });

    it('handles empty leaderboard', async () => {
      vi.mocked(redis.zRange).mockResolvedValue([]);

      const result = await getLeaderboard({ limit: 10 });

      expect(result.entries).toEqual([]);
      expect(result.nextCursor).toBe(-1);
    });

    it('respects limit parameter', async () => {
      vi.mocked(redis.zRange).mockResolvedValue([
        { member: 't2_user1', score: 1000 },
        { member: 't2_user2', score: 800 },
      ]);

      const result = await getLeaderboard({ limit: 2 });

      expect(result.entries).toHaveLength(2);
    });
  });

  describe('getScore', () => {
    it('returns user score', async () => {
      vi.mocked(redis.zScore).mockResolvedValue(1000);

      const result = await getScore('t2_testuser');

      expect(result).toBe(1000);
    });

    it('handles user not found', async () => {
      vi.mocked(redis.zScore).mockResolvedValue(undefined);

      const result = await getScore('t2_nonexistent');

      expect(result).toBe(0);
    });
  });

  describe('incrementScore', () => {
    it('increments user score', async () => {
      vi.mocked(redis.zIncrBy).mockResolvedValue(1100);

      const result = await incrementScore('t2_testuser', 100);

      expect(result).toBe(1100);
      expect(redis.zIncrBy).toHaveBeenCalledWith('scores', 't2_testuser', 100);
    });

    it('handles negative increment', async () => {
      vi.mocked(redis.zIncrBy).mockResolvedValue(900);

      const result = await incrementScore('t2_testuser', -100);

      expect(result).toBe(900);
    });

    it('schedules level up job when user levels up', async () => {
      vi.mocked(redis.zIncrBy).mockResolvedValue(100); // Level 2 threshold

      await incrementScore('t2_testuser', 1);

      expect(scheduler.runJob).toHaveBeenCalledWith({
        name: 'USER_LEVEL_UP',
        data: {
          userId: 't2_testuser',
          score: 100,
          level: expect.any(Object),
          subredditName: 'testsubreddit',
        },
        runAt: expect.any(Date),
      });
    });
  });

  describe('getLevelByScore', () => {
    it('returns correct level for score', () => {
      expect(getLevelByScore(0).rank).toBe(1);
      expect(getLevelByScore(50).rank).toBe(1);
      expect(getLevelByScore(100).rank).toBe(2);
      expect(getLevelByScore(1000).rank).toBe(3);
    });

    it('handles edge cases', () => {
      expect(getLevelByScore(-100).rank).toBe(1);
      expect(getLevelByScore(999999).rank).toBe(5); // Level 5 (Master)
    });
  });

  describe('getUserLevel', () => {
    it('returns user level for score', () => {
      const level = getUserLevel(100);
      expect(level.rank).toBe(2);
    });
  });

  describe('getRank', () => {
    it('returns user rank', async () => {
      vi.mocked(redis.zRank).mockResolvedValue(5);

      const rank = await getRank('t2_testuser');

      expect(rank).toBe(5);
    });

    it('handles user not found', async () => {
      vi.mocked(redis.zRank).mockResolvedValue(undefined);

      const rank = await getRank('t2_nonexistent');

      expect(rank).toBe(-1);
    });
  });
});
