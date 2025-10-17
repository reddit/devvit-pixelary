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
      vi.mocked(redis.zAdd).mockResolvedValue(1); // userAttempts
      vi.mocked(redis.zIncrBy).mockResolvedValue(1); // drawingsByWord and drawingGuesses
      vi.mocked(redis.zAdd).mockResolvedValue(1); // userSolved
      vi.mocked(redis.zCard).mockResolvedValue(1); // playerCount
      vi.mocked(redis.zCard).mockResolvedValue(1); // solvedCount
      vi.mocked(redis.zRange).mockResolvedValue([{ member: 'test', score: 1 }]); // guesses

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
      vi.mocked(redis.zAdd).mockResolvedValue(1); // userAttempts
      vi.mocked(redis.zIncrBy).mockResolvedValue(1); // drawingsByWord and drawingGuesses
      vi.mocked(redis.zCard).mockResolvedValue(1); // playerCount
      vi.mocked(redis.zCard).mockResolvedValue(0); // solvedCount
      vi.mocked(redis.zRange).mockResolvedValue([
        { member: 'wrong', score: 1 },
      ]); // guesses

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

      expect(result.guesses).toEqual({ test: 5, wrong: 2 });
      expect(result.wordCount).toBe(2);
      expect(result.guessCount).toBe(7);
      expect(result.playerCount).toBe(10);
    });
  });
});
