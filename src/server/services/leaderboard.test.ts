import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getLeaderboard,
  getUserScore,
  incrementUserScore,
  awardDrawingSubmission,
  awardCorrectGuess,
  awardAuthorForSolve,
  getLevelByScore,
  getLevel,
  getUserLevel,
  getUserRank,
  getTotalPlayers,
  getUserPosition,
  getLevelProgress,
} from './leaderboard';
import { redis, scheduler } from '@devvit/web/server';
import { LEVELS } from '../../shared/constants';

vi.mock('@devvit/web/server');

describe('Leaderboard Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLeaderboard', () => {
    it('returns leaderboard entries', async () => {
      vi.mocked(redis.zRange).mockResolvedValue([
        { member: 'user1', score: 1000 },
        { member: 'user2', score: 800 },
        { member: 'user3', score: 600 },
      ]);
      vi.mocked(redis.zScore).mockResolvedValue(1000);
      vi.mocked(redis.zScore).mockResolvedValue(800);
      vi.mocked(redis.zScore).mockResolvedValue(600);

      const result = await getLeaderboard(3);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ username: 'user1', score: 1000, rank: 1 });
      expect(result[1]).toEqual({ username: 'user2', score: 800, rank: 2 });
      expect(result[2]).toEqual({ username: 'user3', score: 600, rank: 3 });
    });

    it('handles empty leaderboard', async () => {
      vi.mocked(redis.zRange).mockResolvedValue([]);

      const result = await getLeaderboard(10);

      expect(result).toEqual([]);
    });

    it('respects limit parameter', async () => {
      vi.mocked(redis.zRange).mockResolvedValue([
        { member: 'user1', score: 1000 },
        { member: 'user2', score: 800 },
      ]);
      vi.mocked(redis.zScore).mockResolvedValue(1000);
      vi.mocked(redis.zScore).mockResolvedValue(800);

      const result = await getLeaderboard(2);

      expect(result).toHaveLength(2);
    });
  });

  describe('getUserScore', () => {
    it('returns user score and rank', async () => {
      vi.mocked(redis.zScore).mockResolvedValue(1000);
      vi.mocked(redis.zRank).mockResolvedValue(5);
      vi.mocked(redis.zCard).mockResolvedValue(100);

      const result = await getUserScore('testuser');

      expect(result.score).toBe(1000);
      expect(result.rank).toBe(6); // rank is 0-based, so +1
    });

    it('handles user not found', async () => {
      vi.mocked(redis.zScore).mockResolvedValue(undefined);
      vi.mocked(redis.zRank).mockResolvedValue(undefined);

      const result = await getUserScore('nonexistent');

      expect(result.score).toBe(0);
      expect(result.rank).toBe(0);
    });
  });

  describe('incrementUserScore', () => {
    it('increments user score', async () => {
      vi.mocked(redis.zIncrBy).mockResolvedValue(1100);
      vi.mocked(redis.zRank).mockResolvedValue(5);
      vi.mocked(redis.zCard).mockResolvedValue(100);

      const result = await incrementUserScore('testuser', 100);

      expect(result).toBe(1100);
      expect(redis.zIncrBy).toHaveBeenCalledWith(
        expect.stringContaining('scores'),
        'testuser',
        100
      );
    });

    it('handles negative increment', async () => {
      vi.mocked(redis.zIncrBy).mockResolvedValue(900);
      vi.mocked(redis.zRank).mockResolvedValue(5);
      vi.mocked(redis.zCard).mockResolvedValue(100);

      const result = await incrementUserScore('testuser', -100);

      expect(result).toBe(900);
    });

    it('schedules level up job when user levels up', async () => {
      vi.mocked(redis.zIncrBy).mockResolvedValue(500); // Level 2 threshold
      vi.mocked(redis.zRank).mockResolvedValue(5);
      vi.mocked(redis.zCard).mockResolvedValue(100);
      vi.mocked(redis.zScore).mockResolvedValue(400); // Previous score

      await incrementUserScore('testuser', 100);

      expect(scheduler.runJob).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({
          username: 'testuser',
          score: 500,
          prevLevel: expect.any(Object),
          newLevel: expect.any(Object),
        })
      );
    });
  });

  describe('awardDrawingSubmission', () => {
    it('awards points for drawing submission', async () => {
      vi.mocked(redis.zIncrBy).mockResolvedValue(1010);
      vi.mocked(redis.zRank).mockResolvedValue(5);
      vi.mocked(redis.zCard).mockResolvedValue(100);

      const result = await awardDrawingSubmission('testuser');

      expect(result).toBe(1010);
      expect(redis.zIncrBy).toHaveBeenCalledWith(
        expect.stringContaining('scores'),
        'testuser',
        10
      );
    });
  });

  describe('awardCorrectGuess', () => {
    it('awards points for correct guess', async () => {
      vi.mocked(redis.zIncrBy).mockResolvedValue(1002);
      vi.mocked(redis.zRank).mockResolvedValue(5);
      vi.mocked(redis.zCard).mockResolvedValue(100);

      const result = await awardCorrectGuess('testuser', false);

      expect(result).toBe(1002);
      expect(redis.zIncrBy).toHaveBeenCalledWith(
        expect.stringContaining('scores'),
        'testuser',
        2
      );
    });

    it('awards bonus points for first solve', async () => {
      vi.mocked(redis.zIncrBy).mockResolvedValue(1012);
      vi.mocked(redis.zRank).mockResolvedValue(5);
      vi.mocked(redis.zCard).mockResolvedValue(100);

      const result = await awardCorrectGuess('testuser', true);

      expect(result).toBe(1012);
      expect(redis.zIncrBy).toHaveBeenCalledWith(
        expect.stringContaining('scores'),
        'testuser',
        12
      );
    });
  });

  describe('awardAuthorForSolve', () => {
    it('awards points to author for solve', async () => {
      vi.mocked(redis.zIncrBy).mockResolvedValue(1001);
      vi.mocked(redis.zRank).mockResolvedValue(5);
      vi.mocked(redis.zCard).mockResolvedValue(100);

      const result = await awardAuthorForSolve('testuser');

      expect(result).toBe(1001);
      expect(redis.zIncrBy).toHaveBeenCalledWith(
        expect.stringContaining('scores'),
        'testuser',
        1
      );
    });
  });

  describe('getLevelByScore', () => {
    it('returns correct level for score', () => {
      expect(getLevelByScore(0).rank).toBe(1);
      expect(getLevelByScore(100).rank).toBe(1);
      expect(getLevelByScore(500).rank).toBe(2);
      expect(getLevelByScore(1000).rank).toBe(3);
    });

    it('handles edge cases', () => {
      expect(getLevelByScore(-100).rank).toBe(1);
      expect(getLevelByScore(999999).rank).toBe(
        LEVELS[LEVELS.length - 1]!.rank
      );
    });
  });

  describe('getLevel', () => {
    it('returns correct level by rank', () => {
      const level1 = getLevel(1);
      const level2 = getLevel(2);

      expect(level1?.rank).toBe(1);
      expect(level2?.rank).toBe(2);
    });

    it('returns undefined for invalid rank', () => {
      expect(getLevel(0)).toBeNull();
      expect(getLevel(999)).toBeNull();
      expect(getLevel(-1)).toBeNull();
    });
  });

  describe('getUserLevel', () => {
    it('returns user level for score', () => {
      const level = getUserLevel(500);
      expect(level.rank).toBe(2);
    });
  });

  describe('getUserRank', () => {
    it('returns user rank', async () => {
      vi.mocked(redis.zRank).mockResolvedValue(5);
      vi.mocked(redis.zCard).mockResolvedValue(100);

      const rank = await getUserRank('testuser');

      expect(rank).toBe(6); // rank is 0-based, so +1
    });

    it('handles user not found', async () => {
      vi.mocked(redis.zRank).mockResolvedValue(undefined);

      const rank = await getUserRank('nonexistent');

      expect(rank).toBe(0);
    });
  });

  describe('getTotalPlayers', () => {
    it('returns total player count', async () => {
      vi.mocked(redis.zCard).mockResolvedValue(150);

      const count = await getTotalPlayers();

      expect(count).toBe(150);
    });
  });

  describe('getUserPosition', () => {
    it('returns user position', async () => {
      vi.mocked(redis.zRank).mockResolvedValue(5);
      vi.mocked(redis.zCard).mockResolvedValue(100);

      const position = await getUserPosition('testuser');

      expect(position.rank).toBe(6);
      expect(position.totalPlayers).toBe(100);
    });

    it('handles user not found', async () => {
      vi.mocked(redis.zRank).mockResolvedValue(undefined);
      vi.mocked(redis.zCard).mockResolvedValue(100);

      const position = await getUserPosition('nonexistent');

      expect(position.rank).toBe(0);
      expect(position.totalPlayers).toBe(100);
    });
  });

  describe('getLevelProgress', () => {
    it('returns level progress', () => {
      const progress = getLevelProgress(750);

      expect(progress.currentLevel.rank).toBe(2);
      expect(progress.nextLevel).toBeTruthy();
      expect(progress.progress).toBeGreaterThan(0);
      expect(progress.progress).toBeLessThanOrEqual(100);
    });

    it('handles max level', () => {
      const maxScore = LEVELS[LEVELS.length - 1]!.max + 1000;
      const progress = getLevelProgress(maxScore);

      expect(progress.currentLevel.rank).toBe(LEVELS[LEVELS.length - 1]!.rank);
      expect(progress.nextLevel).toBeNull();
      expect(progress.progress).toBe(100);
    });

    it('handles level 1', () => {
      const progress = getLevelProgress(50);

      expect(progress.currentLevel.rank).toBe(1);
      expect(progress.nextLevel).toBeTruthy();
      expect(progress.progress).toBeGreaterThan(0);
    });
  });
});
