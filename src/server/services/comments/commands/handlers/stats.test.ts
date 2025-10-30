import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CommandContext } from '../comment-commands';
import type { T1, T2, T3, T5 } from '@devvit/shared-types/tid.js';

// Mock the context
vi.mock('@devvit/web/server', () => ({
  context: { subredditName: 'testsub' },
  redis: { hGetAll: vi.fn(), zRange: vi.fn(), zCard: vi.fn() },
}));

// Mock the dictionary service
vi.mock('../../../words/dictionary', () => ({
  isWordInList: vi.fn().mockResolvedValue(true),
}));

// Mock the word-backing service
vi.mock('../../../words/word-backing', () => ({
  addBacker: vi.fn().mockResolvedValue(undefined),
}));

import { redis } from '@devvit/web/server';
import { handleStats, getWordMetrics } from './stats';
import { isWordInList } from '../../../words/dictionary';

const mockContext: CommandContext = {
  commentId: 't1_test123' as T1,
  postId: 't3_test456' as T3,
  authorId: 't2_test789' as T2,
  authorName: 'testuser',
  subredditName: 'testsub',
  subredditId: 't5_testsub' as T5,
  timestamp: Date.now(),
};

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
      } as Record<string, string>;
      const mockWordDrawings: Array<{ member: string; score: number }> = [
        { member: 't3_drawing1', score: 1 },
        { member: 't3_drawing2', score: 2 },
      ];

      vi.mocked(redis.hGetAll).mockResolvedValue(mockTotalStats);
      vi.mocked(redis.zRange).mockResolvedValue(mockWordDrawings);
      vi.mocked(redis.zCard)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(80)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(30)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(40);

      const result = await getWordMetrics(word);

      expect(result).toEqual({
        impressions: 500,
        clicks: 250,
        clickRate: 0.5,
        publishes: 125,
        publishRate: 0.25,
        starts: 150,
        guesses: 120,
        skips: 30,
        solves: 80,
        skipRate: 0.2,
        solveRate: 0.5333333333333333,
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
      } as Record<string, string>;
      const mockWordDrawings: Array<{ member: string; score: number }> = [
        { member: 't3_drawing1', score: 1 },
      ];

      vi.mocked(redis.hGetAll).mockResolvedValue(mockTotalStats);
      vi.mocked(redis.zRange).mockResolvedValue(mockWordDrawings);
      vi.mocked(redis.zCard)
        .mockResolvedValueOnce(25)
        .mockResolvedValueOnce(15)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(20);

      const result = await getWordMetrics(word);

      expect(result).toEqual({
        impressions: 100,
        clicks: 50,
        clickRate: 0.5,
        publishes: 25,
        publishRate: 0.25,
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

      vi.mocked(redis.hGetAll).mockResolvedValue({} as Record<string, string>);
      vi.mocked(redis.zRange).mockResolvedValue(mockWordDrawings);
      vi.mocked(redis.zCard)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(15)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(20);

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
      } as Record<string, string>;

      vi.mocked(redis.hGetAll).mockResolvedValue(mockTotalStats);
      vi.mocked(redis.zRange).mockResolvedValue([]);

      const result = await getWordMetrics(word);

      expect(result).toEqual({
        impressions: 500,
        clicks: 250,
        clickRate: 0.5,
        publishes: 125,
        publishRate: 0.25,
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
      } as Record<string, string>;

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
      } as Record<string, string>;

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
      } as Record<string, string>;
      const mockWordDrawings: Array<{ member: string; score: number }> = [
        { member: 't3_drawing1', score: 1 },
      ];

      vi.mocked(redis.hGetAll).mockResolvedValue(mockTotalStats);
      vi.mocked(redis.zRange).mockResolvedValue(mockWordDrawings);
      vi.mocked(redis.zCard)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(40)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(50);

      const result = await getWordMetrics(word);

      expect(result.clickRate).toBe(0.3);
      expect(result.publishRate).toBe(0.2);
      expect(result.skipRate).toBe(0.2);
      expect(result.solveRate).toBe(0.8);
    });

    it('should handle Redis errors gracefully', async () => {
      const word = 'test';

      vi.mocked(redis.hGetAll).mockRejectedValue(new Error('Redis error'));

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

    it('should handle invalid numeric values', async () => {
      const word = 'test';
      const mockTotalStats = {
        'Test:served': 'invalid',
        'Test:picked': '250',
        'Test:posted': '125',
      } as Record<string, string>;

      vi.mocked(redis.hGetAll).mockResolvedValue(mockTotalStats);
      vi.mocked(redis.zRange).mockResolvedValue([]);

      const result = await getWordMetrics(word);

      expect(result.impressions).toBeNaN();
      expect(result.clicks).toBe(250);
      expect(result.clickRate).toBe(0);
    });
  });

  describe('handleStats', () => {
    it('should return formatted stats for a word', async () => {
      const args = ['test'];
      vi.mocked(isWordInList).mockResolvedValue(true);
      vi.mocked(redis.hGetAll).mockResolvedValue({
        'Test:served': '100',
        'Test:picked': '50',
        'Test:posted': '25',
      } as Record<string, string>);
      vi.mocked(redis.zRange).mockResolvedValue([]);

      const result = await handleStats(args, mockContext);

      expect(result.success).toBe(true);
      expect(result.response).toContain('100');
      expect(result.response).toContain('50');
      expect(result.response).toContain('25');
      expect(result.response).toContain('0');
    });

    it('should handle missing word argument', async () => {
      const args: string[] = [];
      const result = await handleStats(args, mockContext);
      expect(result.success).toBe(true);
      expect(result.response).toContain('Usage');
    });

    it('should handle word not found', async () => {
      const args = ['nonexistent'];
      vi.mocked(isWordInList).mockResolvedValue(false);
      const result = await handleStats(args, mockContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Word not found');
    });

    it('should handle getWordMetrics errors', async () => {
      const args = ['test'];
      vi.mocked(isWordInList).mockResolvedValue(true);
      vi.mocked(redis.hGetAll).mockRejectedValue(new Error('Database error'));
      const result = await handleStats(args, mockContext);
      expect(result.success).toBe(true);
      expect(result.response).toContain('0');
    });

    it('should format percentages correctly', async () => {
      const args = ['test'];
      vi.mocked(isWordInList).mockResolvedValue(true);
      vi.mocked(redis.hGetAll).mockResolvedValue({
        'Test:served': '100',
        'Test:picked': '33',
        'Test:posted': '10',
      } as Record<string, string>);
      vi.mocked(redis.zRange).mockResolvedValue([
        { member: 't3_drawing1', score: 1 },
      ]);
      vi.mocked(redis.zCard)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(23)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(30);

      const result = await handleStats(args, mockContext);

      expect(result.success).toBe(true);
      expect(result.response).toContain('33.0%');
      expect(result.response).toContain('10.0%');
      expect(result.response).toContain('70.0%');
      expect(result.response).toContain('230.0%');
    });
  });
});
