import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @devvit/web/server before importing the module
vi.mock('@devvit/web/server', () => ({
  redis: {
    zScore: vi.fn(),
    hGet: vi.fn(),
    hGetAll: vi.fn(),
    hSet: vi.fn(),
    zAdd: vi.fn(),
    zIncrBy: vi.fn(),
    zCard: vi.fn(),
    zRange: vi.fn(),
    exists: vi.fn(),
    set: vi.fn(),
    expire: vi.fn(),
    incrBy: vi.fn(),
  },
  scheduler: {
    runJob: vi.fn(),
  },
  realtime: {
    send: vi.fn(() => Promise.resolve()),
  },
  cache: vi.fn((fn) => fn()), // Mock cache to just execute the function
}));

vi.mock('./progression', () => ({
  incrementScore: vi.fn(),
}));

vi.mock('../core/post', () => ({
  createPost: vi.fn(),
}));

vi.mock('./redis', () => ({
  REDIS_KEYS: {
    drawing: (postId: string) => `d:${postId}`,
    drawingGuesses: (postId: string) => `guesses:${postId}`,
    drawingAttempts: (postId: string) => `attempts:${postId}`,
    drawingSolves: (postId: string) => `solves:${postId}`,
    drawingSkips: (postId: string) => `skips:${postId}`,
    authorViews: (postId: string) => `d:author_views:${postId}`,
    wordDrawings: (word: string) => `d:w:${word}`,
    commentUpdateLock: (postId: string) => `comment_update_lock:${postId}`,
    scores: () => 'scores',
  },
}));

import { submitGuess, getGuesses, isAuthorFirstView } from './drawing';
import { REDIS_KEYS } from './redis';
import { redis } from '@devvit/web/server';

describe('Drawing Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('submitGuess', () => {
    it('returns correct guess result for correct guess', async () => {
      vi.mocked(redis.zScore).mockResolvedValue(undefined); // Not solved yet
      vi.mocked(redis.hGetAll).mockResolvedValue({
        word: 'test',
        authorId: 't2_author123',
      });
      vi.mocked(redis.zAdd).mockResolvedValue(1); // drawingAttempts
      vi.mocked(redis.zIncrBy).mockResolvedValue(1); // wordDrawings and drawingGuesses
      vi.mocked(redis.zAdd).mockResolvedValue(1); // drawingSolves
      vi.mocked(redis.zCard).mockResolvedValue(1); // playerCount
      vi.mocked(redis.zCard).mockResolvedValue(1); // solvedCount
      vi.mocked(redis.zRange).mockResolvedValue([{ member: 'test', score: 1 }]); // guesses

      const result = await submitGuess({
        postId: 't3_test123',
        userId: 't2_testuser',
        guess: 'test',
      });

      expect(result.correct).toBe(true);
      expect(result.points).toBe(5);
    });

    it('returns incorrect guess result for wrong guess', async () => {
      vi.mocked(redis.zScore).mockResolvedValue(undefined); // Not solved yet
      vi.mocked(redis.hGetAll).mockResolvedValue({
        word: 'correct',
        authorId: 't2_author123',
      });
      vi.mocked(redis.zAdd).mockResolvedValue(1); // drawingAttempts
      vi.mocked(redis.zIncrBy).mockResolvedValue(1); // wordDrawings and drawingGuesses
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
      vi.mocked(redis.zCard).mockResolvedValueOnce(10); // playerCount
      vi.mocked(redis.zCard).mockResolvedValueOnce(3); // solvedCount

      const result = await getGuesses('t3_test123', 10);

      expect(result.guesses).toEqual({ test: 5, wrong: 2 });
      expect(result.wordCount).toBe(2);
      expect(result.guessCount).toBe(7);
      expect(result.playerCount).toBe(10);
    });
  });

  describe('isAuthorFirstView', () => {
    it('returns true when marking first view', async () => {
      vi.mocked(redis.incrBy).mockResolvedValue(1);

      const result = await isAuthorFirstView('t3_test123');

      expect(result).toBe(true);
      expect(redis.incrBy).toHaveBeenCalledWith(
        REDIS_KEYS.authorViews('t3_test123'),
        1
      );
    });

    it('returns false when marking subsequent view', async () => {
      vi.mocked(redis.incrBy).mockResolvedValue(2);

      const result = await isAuthorFirstView('t3_test123');

      expect(result).toBe(false);
      expect(redis.incrBy).toHaveBeenCalledWith(
        REDIS_KEYS.authorViews('t3_test123'),
        1
      );
    });
  });
});
