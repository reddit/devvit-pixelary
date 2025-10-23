import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the context
vi.mock('@devvit/web/server', () => ({
  context: {
    subredditName: 'testsub',
  },
  redis: {
    hGetAll: vi.fn(),
    zRange: vi.fn(),
    zCard: vi.fn(),
  },
}));

// Mock the dictionary service
vi.mock('../dictionary', () => ({
  isWordInList: vi.fn().mockResolvedValue(true),
}));

import { redis, context } from '@devvit/web/server';
import { handleStats, getWordMetrics } from './stats';
import { REDIS_KEYS } from './redis';
import { isWordInList } from '../dictionary';

describe('Stats Comment Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getWordMetrics', () => {
    it('should calculate metrics correctly with complete data', async () => {
      const word = 'test';
      const mockTotalStats = {
        'Test:served': '500',
        'Test:picked': '250',
        'Test:posted': '125',
      };
      const mockWordDrawings = [
        { member: 't3_drawing1', score: 1 },
        { member: 't3_drawing2', score: 2 },
      ];

      vi.mocked(redis.hGetAll).mockResolvedValue(mockTotalStats);
      vi.mocked(redis.zRange).mockResolvedValue(mockWordDrawings);
      vi.mocked(redis.zCard)
        .mockResolvedValueOnce(100) // drawingAttempts for drawing1
        .mockResolvedValueOnce(50) // drawingSolves for drawing1
        .mockResolvedValueOnce(20) // drawingSkips for drawing1
        .mockResolvedValueOnce(80) // drawingGuesses for drawing1
        .mockResolvedValueOnce(50) // drawingAttempts for drawing2
        .mockResolvedValueOnce(30) // drawingSolves for drawing2
        .mockResolvedValueOnce(10) // drawingSkips for drawing2
        .mockResolvedValueOnce(40); // drawingGuesses for drawing2

      const result = await getWordMetrics(word);

      expect(result).toEqual({
        impressions: 500,
        clicks: 250,
        clickRate: 0.5,
        publishes: 125,
        publishRate: 0.25, // 125/500
        starts: 150, // 100 + 50
        guesses: 120, // 80 + 40
        skips: 30, // 20 + 10
        solves: 80, // 50 + 30
        skipRate: 0.2, // 30/150
        solveRate: 0.5333333333333333, // 80/150
        upvotes: 0,
        comments: 0,
      });
    });

    it('should handle missing hourly stats', async () => {
      const word = 'test';
      const mockTotalStats = {
        'Test:served': '100',
        'Test:picked': '50',
        'Test:posted': '25',
      };
      const mockWordDrawings = [{ member: 't3_drawing1', score: 1 }];

      vi.mocked(redis.hGetAll).mockResolvedValue(mockTotalStats);
      vi.mocked(redis.zRange).mockResolvedValue(mockWordDrawings);
      vi.mocked(redis.zCard)
        .mockResolvedValueOnce(25) // drawingAttempts
        .mockResolvedValueOnce(15) // drawingSolves
        .mockResolvedValueOnce(5) // drawingSkips
        .mockResolvedValueOnce(20); // drawingGuesses

      const result = await getWordMetrics(word);

      expect(result).toEqual({
        impressions: 100,
        clicks: 50,
        clickRate: 0.5,
        publishes: 25,
        publishRate: 0.25, // 25/100
        starts: 25,
        guesses: 20,
        skips: 5,
        solves: 15,
        skipRate: 0.2,
        solveRate: 0.6,
        upvotes: 0,
        comments: 0,
      });
    });

    it('should handle missing total stats', async () => {
      const word = 'test';
      const mockWordDrawings = [{ member: 't3_drawing1', score: 1 }];

      vi.mocked(redis.hGetAll).mockResolvedValue({}); // Empty total stats
      vi.mocked(redis.zRange).mockResolvedValue(mockWordDrawings);
      vi.mocked(redis.zCard)
        .mockResolvedValueOnce(20) // drawingAttempts
        .mockResolvedValueOnce(15) // drawingSolves
        .mockResolvedValueOnce(5) // drawingSkips
        .mockResolvedValueOnce(20); // drawingGuesses

      const result = await getWordMetrics(word);

      expect(result).toEqual({
        impressions: 0,
        clicks: 0,
        clickRate: 0,
        publishes: 0,
        publishRate: 0,
        starts: 20,
        guesses: 20,
        skips: 5,
        solves: 15,
        skipRate: 0.25,
        solveRate: 0.75,
        upvotes: 0,
        comments: 0,
      });
    });

    it('should handle missing drawing stats', async () => {
      const word = 'test';
      const mockTotalStats = {
        'Test:served': '500',
        'Test:picked': '250',
        'Test:posted': '125',
      };

      vi.mocked(redis.hGetAll).mockResolvedValue(mockTotalStats);
      vi.mocked(redis.zRange).mockResolvedValue([]); // No drawings

      const result = await getWordMetrics(word);

      expect(result).toEqual({
        impressions: 500,
        clicks: 250,
        clickRate: 0.5,
        publishes: 125,
        publishRate: 0.25, // 125/500
        starts: 0,
        guesses: 0,
        skips: 0,
        solves: 0,
        skipRate: 0,
        solveRate: 0,
        upvotes: 0,
        comments: 0,
      });
    });

    it('should handle zero values correctly', async () => {
      const word = 'test';
      const mockTotalStats = {
        'Test:served': '0',
        'Test:picked': '0',
        'Test:posted': '0',
      };

      vi.mocked(redis.hGetAll).mockResolvedValue(mockTotalStats);
      vi.mocked(redis.zRange).mockResolvedValue([]);

      const result = await getWordMetrics(word);

      expect(result).toEqual({
        impressions: 0,
        clicks: 0,
        clickRate: 0,
        publishes: 0,
        publishRate: 0,
        starts: 0,
        guesses: 0,
        skips: 0,
        solves: 0,
        skipRate: 0,
        solveRate: 0,
        upvotes: 0,
        comments: 0,
      });
    });

    it('should handle division by zero in rates', async () => {
      const word = 'test';
      const mockTotalStats = {
        'Test:served': '0',
        'Test:picked': '0',
        'Test:posted': '0',
      };

      vi.mocked(redis.hGetAll).mockResolvedValue(mockTotalStats);
      vi.mocked(redis.zRange).mockResolvedValue([]);

      const result = await getWordMetrics(word);

      expect(result.clickRate).toBe(0);
      expect(result.publishRate).toBe(0);
      expect(result.skipRate).toBe(0);
      expect(result.solveRate).toBe(0);
    });

    it('should calculate rates correctly with non-zero denominators', async () => {
      const word = 'test';
      const mockTotalStats = {
        'Test:served': '100',
        'Test:picked': '30',
        'Test:posted': '20',
      };
      const mockWordDrawings = [{ member: 't3_drawing1', score: 1 }];

      vi.mocked(redis.hGetAll).mockResolvedValue(mockTotalStats);
      vi.mocked(redis.zRange).mockResolvedValue(mockWordDrawings);
      vi.mocked(redis.zCard)
        .mockResolvedValueOnce(50) // drawingAttempts
        .mockResolvedValueOnce(40) // drawingSolves
        .mockResolvedValueOnce(10) // drawingSkips
        .mockResolvedValueOnce(50); // drawingGuesses

      const result = await getWordMetrics(word);

      expect(result.clickRate).toBe(0.3);
      expect(result.publishRate).toBe(0.2);
      expect(result.skipRate).toBe(0.2); // 10/50
      expect(result.solveRate).toBe(0.8); // 40/50
    });

    it('should handle Redis errors gracefully', async () => {
      const word = 'test';

      vi.mocked(redis.hGetAll).mockRejectedValue(new Error('Redis error'));

      const result = await getWordMetrics(word);

      // Should return zero metrics on error
      expect(result).toEqual({
        impressions: 0,
        clicks: 0,
        clickRate: 0,
        publishes: 0,
        publishRate: 0,
        starts: 0,
        guesses: 0,
        skips: 0,
        solves: 0,
        skipRate: 0,
        solveRate: 0,
        upvotes: 0,
        comments: 0,
      });
    });

    it('should handle invalid numeric values', async () => {
      const word = 'test';
      const mockTotalStats = {
        'Test:served': 'invalid',
        'Test:picked': '250',
        'Test:posted': '125',
      };

      vi.mocked(redis.hGetAll).mockResolvedValue(mockTotalStats);
      vi.mocked(redis.zRange).mockResolvedValue([]);

      const result = await getWordMetrics(word);

      expect(result.impressions).toBe(NaN); // Should be NaN for invalid value
      expect(result.clicks).toBe(250);
      expect(result.clickRate).toBe(0); // 250/NaN = 0 (due to error handling)
    });
  });

  describe('handleStats', () => {
    it('should return formatted stats for a word', async () => {
      const args = ['test'];

      // Mock isWordInList to return true
      vi.mocked(isWordInList).mockResolvedValue(true);

      // Mock the Redis calls directly
      vi.mocked(redis.hGetAll).mockResolvedValue({
        'Test:served': '100',
        'Test:picked': '50',
        'Test:posted': '25',
      });
      vi.mocked(redis.zRange).mockResolvedValue([]);

      const result = await handleStats(args);

      expect(result.success).toBe(true);
      expect(result.response).toContain('100');
      expect(result.response).toContain('50');
      expect(result.response).toContain('25');
      expect(result.response).toContain('0'); // starts, guesses, etc. are 0 when no drawings
    });

    it('should handle missing word argument', async () => {
      const args: string[] = [];

      const result = await handleStats(args);

      expect(result.success).toBe(true); // Should return success with usage message
      expect(result.response).toContain('Usage');
    });

    it('should handle word not found', async () => {
      const args = ['nonexistent'];

      // Mock isWordInList to return false
      vi.mocked(isWordInList).mockResolvedValue(false);

      const result = await handleStats(args);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Word not found');
    });

    it('should handle getWordMetrics errors', async () => {
      const args = ['test'];

      // Mock isWordInList to return true so we get to the getWordMetrics call
      vi.mocked(isWordInList).mockResolvedValue(true);

      // Mock Redis to throw an error
      vi.mocked(redis.hGetAll).mockRejectedValue(new Error('Database error'));

      const result = await handleStats(args);

      // The service handles Redis errors gracefully by returning zero metrics
      expect(result.success).toBe(true);
      expect(result.response).toContain('0'); // All metrics should be 0 due to error handling
    });

    it('should format percentages correctly', async () => {
      const args = ['test'];

      // Mock isWordInList to return true
      vi.mocked(isWordInList).mockResolvedValue(true);

      // Mock the Redis calls to return specific values
      vi.mocked(redis.hGetAll).mockResolvedValue({
        'Test:served': '100',
        'Test:picked': '33',
        'Test:posted': '10',
      });
      vi.mocked(redis.zRange).mockResolvedValue([
        { member: 't3_drawing1', score: 1 },
      ]);
      vi.mocked(redis.zCard)
        .mockResolvedValueOnce(10) // drawingAttempts
        .mockResolvedValueOnce(23) // drawingSolves
        .mockResolvedValueOnce(7) // drawingSkips
        .mockResolvedValueOnce(30); // drawingGuesses

      const result = await handleStats(args);

      expect(result.success).toBe(true);
      expect(result.response).toContain('33.0%');
      expect(result.response).toContain('10.0%');
      expect(result.response).toContain('70.0%');
      expect(result.response).toContain('230.0%');
    });
  });
});
