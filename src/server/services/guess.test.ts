import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  submitGuess,
  getGuessStats,
  recordGuess,
  getSolveCount,
  saveGuessComment,
  getGuessComments,
  removeGuessComment,
  getTopGuesses,
  getUserGuessHistory,
} from './guess';
import { redis } from '@devvit/web/server';

vi.mock('@devvit/web/server');

describe('Guess Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('submitGuess', () => {
    it('returns correct guess result for correct guess', async () => {
      const mockPostData = {
        word: 'test',
        authorUsername: 'author',
        dictionaryName: 'main',
      };

      vi.mocked(redis.hGet).mockResolvedValue(JSON.stringify(mockPostData));
      vi.mocked(redis.zScore).mockResolvedValue(0); // Not solved yet
      vi.mocked(redis.zScore).mockResolvedValue(0); // User hasn't solved
      vi.mocked(redis.hIncrBy).mockResolvedValue(1);
      vi.mocked(redis.zAdd).mockResolvedValue(1);
      vi.mocked(redis.zAdd).mockResolvedValue(1);
      vi.mocked(redis.zScore).mockResolvedValue(1);
      vi.mocked(redis.zRank).mockResolvedValue(0);

      const result = await submitGuess('t3_test123', 'testuser', 'test', false);

      expect(result.correct).toBe(true);
      expect(result.points).toBe(2);
      expect(result.isFirstSolve).toBe(true);
    });

    it('returns incorrect guess result for wrong guess', async () => {
      const mockPostData = {
        word: 'correct',
        authorUsername: 'author',
        dictionaryName: 'main',
      };

      vi.mocked(redis.hGet).mockResolvedValue(JSON.stringify(mockPostData));
      vi.mocked(redis.zScore).mockResolvedValue(0); // Not solved yet
      vi.mocked(redis.zScore).mockResolvedValue(0); // User hasn't solved

      const result = await submitGuess(
        't3_test123',
        'testuser',
        'wrong',
        false
      );

      expect(result.correct).toBe(false);
      expect(result.points).toBe(0);
      expect(result.isFirstSolve).toBe(false);
    });

    it('handles already solved post', async () => {
      const mockPostData = {
        word: 'test',
        authorUsername: 'author',
        dictionaryName: 'main',
      };

      vi.mocked(redis.hGet).mockResolvedValue(JSON.stringify(mockPostData));
      vi.mocked(redis.zScore).mockResolvedValue(1); // Already solved

      const result = await submitGuess('t3_test123', 'testuser', 'test', false);

      expect(result.correct).toBe(false);
      expect(result.points).toBe(0);
      expect(result.isFirstSolve).toBe(false);
    });

    it('handles user who already solved', async () => {
      const mockPostData = {
        word: 'test',
        authorUsername: 'author',
        dictionaryName: 'main',
      };

      vi.mocked(redis.hGet).mockResolvedValue(JSON.stringify(mockPostData));
      vi.mocked(redis.zScore).mockResolvedValue(0); // Not solved yet
      vi.mocked(redis.zScore).mockResolvedValue(1); // User already solved

      const result = await submitGuess('t3_test123', 'testuser', 'test', false);

      expect(result.correct).toBe(false);
      expect(result.points).toBe(0);
      expect(result.isFirstSolve).toBe(false);
    });

    it('creates comment when requested', async () => {
      const mockPostData = {
        word: 'test',
        authorUsername: 'author',
        dictionaryName: 'main',
      };

      vi.mocked(redis.hGet).mockResolvedValue(JSON.stringify(mockPostData));
      vi.mocked(redis.zScore).mockResolvedValue(0);
      vi.mocked(redis.zScore).mockResolvedValue(0);
      vi.mocked(redis.hIncrBy).mockResolvedValue(1);
      vi.mocked(redis.zAdd).mockResolvedValue(1);
      vi.mocked(redis.zAdd).mockResolvedValue(1);
      vi.mocked(redis.zScore).mockResolvedValue(1);
      vi.mocked(redis.zRank).mockResolvedValue(0);
      vi.mocked(redis.hSet).mockResolvedValue(1);

      await submitGuess('t3_test123', 'testuser', 'test', true);

      expect(redis.hSet).toHaveBeenCalledWith(
        expect.stringContaining('guess-comments'),
        expect.any(String),
        expect.any(String)
      );
    });
  });

  describe('getGuessStats', () => {
    it('returns guess statistics', async () => {
      const mockGuesses = { 'test': 5, 'wrong': 2 };
      const mockGuessCount = 7;
      const mockPlayerCount = 3;

      vi.mocked(redis.hGetAll).mockResolvedValue({
        'test': '5',
        'wrong': '2',
      });
      vi.mocked(redis.hGet).mockResolvedValue('7');
      vi.mocked(redis.zCard).mockResolvedValue(3);

      const result = await getGuessStats('t3_test123');

      expect(result.guesses).toEqual(mockGuesses);
      expect(result.guessCount).toBe(mockGuessCount);
      expect(result.playerCount).toBe(mockPlayerCount);
    });

    it('handles empty guess data', async () => {
      vi.mocked(redis.hGetAll).mockResolvedValue({});
      vi.mocked(redis.hGet).mockResolvedValue('0');
      vi.mocked(redis.zCard).mockResolvedValue(0);

      const result = await getGuessStats('t3_test123');

      expect(result.guesses).toEqual({});
      expect(result.guessCount).toBe(0);
      expect(result.playerCount).toBe(0);
    });
  });

  describe('recordGuess', () => {
    it('records guess correctly', async () => {
      vi.mocked(redis.hIncrBy).mockResolvedValue(1);

      await recordGuess('t3_test123', 'test');

      expect(redis.hIncrBy).toHaveBeenCalledWith(
        expect.stringContaining('guesses'),
        'test',
        1
      );
    });
  });

  describe('getSolveCount', () => {
    it('returns solve count', async () => {
      vi.mocked(redis.zCard).mockResolvedValue(5);

      const count = await getSolveCount('t3_test123');

      expect(count).toBe(5);
    });
  });

  describe('saveGuessComment', () => {
    it('saves guess comment', async () => {
      vi.mocked(redis.hSet).mockResolvedValue(1);

      const result = await saveGuessComment('t3_test123', 'test', 'comment123');

      expect(result).toBe(true);
      expect(redis.hSet).toHaveBeenCalledWith(
        expect.stringContaining('guess-comments'),
        'comment123',
        'test'
      );
    });
  });

  describe('getGuessComments', () => {
    it('returns guess comments', async () => {
      const mockComments = {
        'comment1': 'test',
        'comment2': 'wrong',
      };

      vi.mocked(redis.hGetAll).mockResolvedValue(mockComments);

      const result = await getGuessComments('t3_test123');

      expect(result).toEqual(mockComments);
    });

    it('handles empty comments', async () => {
      vi.mocked(redis.hGetAll).mockResolvedValue({});

      const result = await getGuessComments('t3_test123');

      expect(result).toEqual({});
    });
  });

  describe('removeGuessComment', () => {
    it('removes guess comment', async () => {
      vi.mocked(redis.hDel).mockResolvedValue(1);

      const result = await removeGuessComment('t3_test123', 'comment123');

      expect(result).toBe(true);
      expect(redis.hDel).toHaveBeenCalledWith(
        expect.stringContaining('guess-comments'),
        'comment123'
      );
    });

    it('handles non-existent comment', async () => {
      vi.mocked(redis.hDel).mockResolvedValue(0);

      const result = await removeGuessComment('t3_test123', 'nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getTopGuesses', () => {
    it('returns top guesses', async () => {
      const mockGuesses = {
        'test': '5',
        'wrong': '2',
        'guess': '3',
      };

      vi.mocked(redis.hGetAll).mockResolvedValue(mockGuesses);

      const result = await getTopGuesses('t3_test123', 2);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ word: 'test', count: 5 });
      expect(result[1]).toEqual({ word: 'guess', count: 3 });
    });

    it('handles empty guesses', async () => {
      vi.mocked(redis.hGetAll).mockResolvedValue({});

      const result = await getTopGuesses('t3_test123', 10);

      expect(result).toEqual([]);
    });
  });

  describe('getUserGuessHistory', () => {
    it('returns user guess history', async () => {
      const mockHistory = [
        { postId: 't3_test1', guess: 'test', correct: true, timestamp: 1000 },
        { postId: 't3_test2', guess: 'wrong', correct: false, timestamp: 2000 },
      ];

      vi.mocked(redis.zRange).mockResolvedValue(
        mockHistory.map((h) => ({
          member: JSON.stringify(h),
          score: h.timestamp,
        }))
      );

      const result = await getUserGuessHistory('testuser', 10);

      expect(result).toEqual(mockHistory);
    });

    it('handles empty history', async () => {
      vi.mocked(redis.zRange).mockResolvedValue([]);

      const result = await getUserGuessHistory('testuser', 10);

      expect(result).toEqual([]);
    });
  });
});
