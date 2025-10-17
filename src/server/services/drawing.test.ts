import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitGuess, getGuesses } from './drawing';
import { redis } from '@devvit/web/server';

vi.mock('@devvit/web/server');

describe('Drawing Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('submitGuess', () => {
    it('returns correct guess result for correct guess', async () => {
      vi.mocked(redis.zScore).mockResolvedValue(undefined); // Not solved yet
      vi.mocked(redis.hGet).mockResolvedValueOnce('test'); // word
      vi.mocked(redis.hGet).mockResolvedValueOnce('t2_author123'); // authorId
      vi.mocked(redis.zIncrBy).mockResolvedValue(1);
      vi.mocked(redis.zAdd).mockResolvedValue(1);

      const result = await submitGuess({
        postId: 't3_test123',
        userId: 't2_testuser',
        guess: 'test',
      });

      expect(result.correct).toBe(true);
      expect(result.points).toBe(1);
    });

    it('returns incorrect guess result for wrong guess', async () => {
      vi.mocked(redis.zScore).mockResolvedValue(undefined); // Not solved yet
      vi.mocked(redis.hGet).mockResolvedValueOnce('correct'); // word
      vi.mocked(redis.hGet).mockResolvedValueOnce('t2_author123'); // authorId
      vi.mocked(redis.zIncrBy).mockResolvedValue(1);

      const result = await submitGuess({
        postId: 't3_test123',
        userId: 't2_testuser',
        guess: 'wrong',
      });

      expect(result.correct).toBe(false);
      expect(result.points).toBe(0);
    });
  });

  describe('getGuesses', () => {
    it('returns guesses for a drawing', async () => {
      const mockGuesses = [
        { member: 'test', score: 5 },
        { member: 'wrong', score: 2 },
      ];

      vi.mocked(redis.zRange).mockResolvedValue(mockGuesses);
      vi.mocked(redis.zCard).mockResolvedValue(10); // playerCount
      vi.mocked(redis.zCard).mockResolvedValue(3); // solvedCount

      const result = await getGuesses('t3_test123', 10);

      expect(result.guesses).toHaveLength(2);
      expect(result.guesses[0]).toEqual({ word: 'test', count: 5, rank: 1 });
      expect(result.playerCount).toBe(10);
      expect(result.solvedPercentage).toBe(30);
    });
  });
});
