import { describe, it, expect, vi, beforeEach } from 'vitest';
import { redis } from '@devvit/web/server';
import {
  getSlateBanditConfig,
  setSlateBanditConfig,
  initSlateBandit,
  pickWordsWithUCB,
  generateSlate,
  updateWordScores,
  applyScoreDecay,
} from './slate';
import { REDIS_KEYS } from './redis';

// Mock the context
vi.mock('@devvit/web/server', () => ({
  context: {
    subredditName: 'test-subreddit',
  },
  redis: {
    hGetAll: vi.fn(),
    hSet: vi.fn(),
    hIncrBy: vi.fn(),
    exists: vi.fn(),
    zAdd: vi.fn(),
    zRange: vi.fn(),
    zCard: vi.fn(),
    zScore: vi.fn(),
    expire: vi.fn(),
  },
}));

describe('Slate System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should return default config when no config exists', async () => {
      vi.mocked(redis.hGetAll).mockResolvedValue({});

      const config = await getSlateBanditConfig();

      expect(config.explorationRate).toBe(0.1);
      expect(config.zScoreClamp).toBe(3);
      expect(config.weightPickRate).toBe(1);
      expect(config.weightPostRate).toBe(1);
      expect(config.ucbConstant).toBe(2);
      expect(config.scoreDecayRate).toBe(0.1);
    });

    it('should validate and clamp config values', async () => {
      vi.mocked(redis.hGetAll).mockResolvedValue({
        explorationRate: '1.5', // Should be clamped to 1
        zScoreClamp: '-1', // Should be clamped to 0.1
        weightPickRate: '-0.5', // Should be clamped to 0
        ucbConstant: '0.05', // Should be clamped to 0.1
        scoreDecayRate: '2.0', // Should be clamped to 1
      });

      const config = await getSlateBanditConfig();

      expect(config.explorationRate).toBe(1);
      expect(config.zScoreClamp).toBe(0.1);
      expect(config.weightPickRate).toBe(0);
      expect(config.ucbConstant).toBe(0.1);
      expect(config.scoreDecayRate).toBe(1);
    });

    it('should set config correctly', async () => {
      const config = {
        explorationRate: 0.2,
        zScoreClamp: 2,
        weightPickRate: 1.5,
        weightPostRate: 0.8,
        ucbConstant: 1.5,
        scoreDecayRate: 0.15,
      };

      await setSlateBanditConfig(config);

      expect(redis.hSet).toHaveBeenCalledWith(
        REDIS_KEYS.slateConfig(),
        expect.objectContaining({
          explorationRate: '0.2',
          zScoreClamp: '2',
          weightPickRate: '1.5',
          weightPostRate: '0.8',
          ucbConstant: '1.5',
          scoreDecayRate: '0.15',
        })
      );
    });
  });

  describe('Score Decay', () => {
    it('should apply exponential decay to scores', async () => {
      const wordStats = {
        'word1': {
          hourly: {
            served: 10,
            picked: 5,
            posted: 2,
            pickRate: 0.5,
            postRate: 0.4,
          },
          total: { served: 100, picked: 50, posted: 20 },
          drawerScore: 1.0,
          drawerUncertainty: 0.1,
        },
        'word2': {
          hourly: { served: 0, picked: 0, posted: 0, pickRate: 0, postRate: 0 },
          total: { served: 0, picked: 0, posted: 0 },
          drawerScore: 0.5,
          drawerUncertainty: 1.0,
        },
      };

      const config = { scoreDecayRate: 0.1 } as {
        scoreDecayRate: number;
      };

      // Mock Redis to return last served timestamps
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000; // 1 day ago
      vi.mocked(redis.zRange).mockResolvedValue([
        { member: 'word1', score: oneDayAgo },
        { member: 'word2', score: now }, // Never served, but has timestamp
      ]);

      const result = await applyScoreDecay(wordStats, config);

      // Word1 should have decay applied (served recently)
      expect(result['word1'].drawerScore).toBeLessThan(1.0);
      expect(result['word1'].drawerScore).toBeGreaterThan(0);

      // Word2 should not have decay applied (never served)
      expect(result['word2'].drawerScore).toBe(0.5);
    });
  });

  describe('UCB Word Selection', () => {
    it('should select words based on UCB scores', async () => {
      const mockWords = [
        { member: 'word1', score: 1.0 },
        { member: 'word2', score: 0.5 },
        { member: 'word3', score: 0.8 },
      ];

      const mockUncertainties = [
        { member: 'word1', score: 0.1 },
        { member: 'word2', score: 0.3 },
        { member: 'word3', score: 0.2 },
      ];

      vi.mocked(redis.zRange)
        .mockResolvedValueOnce(mockWords)
        .mockResolvedValueOnce(mockUncertainties);

      vi.mocked(redis.hGetAll).mockResolvedValue({
        ucbConstant: '2',
      });

      const words = await pickWordsWithUCB(2);

      expect(words).toHaveLength(2);
      expect(
        words.every((word) => ['word1', 'word2', 'word3'].includes(word))
      ).toBe(true);
    });

    it('should throw error if not enough words available', async () => {
      vi.mocked(redis.zRange).mockResolvedValueOnce([
        { member: 'word1', score: 1.0 },
        { member: 'word2', score: 0.5 },
      ]);

      vi.mocked(redis.hGetAll).mockResolvedValue({});

      await expect(pickWordsWithUCB(5)).rejects.toThrow(
        'Not enough words available'
      );
    });
  });

  describe('Slate Generation', () => {
    it('should generate a slate with 3 words', async () => {
      const mockWords = [
        { member: 'word1', score: 1.0 },
        { member: 'word2', score: 0.5 },
        { member: 'word3', score: 0.8 },
        { member: 'word4', score: 0.3 },
      ];

      const mockUncertainties = [
        { member: 'word1', score: 0.1 },
        { member: 'word2', score: 0.3 },
        { member: 'word3', score: 0.2 },
        { member: 'word4', score: 0.4 },
      ];

      vi.mocked(redis.zRange)
        .mockResolvedValueOnce(mockWords)
        .mockResolvedValueOnce(mockUncertainties)
        .mockResolvedValueOnce(mockWords.slice(0, 3)); // For backfill

      vi.mocked(redis.hGetAll).mockResolvedValue({});
      vi.mocked(redis.hSet).mockResolvedValue(0);
      vi.mocked(redis.expire).mockResolvedValue(1);

      const slate = await generateSlate();

      expect(slate.words).toHaveLength(3);
      expect(slate.slateId).toMatch(/^slate_/);
      expect(slate.timestamp).toBeGreaterThan(0);
    });
  });

  describe('Score Updates', () => {
    it('should handle empty word list gracefully', async () => {
      vi.mocked(redis.zRange).mockResolvedValueOnce([]);
      vi.mocked(redis.hGetAll).mockResolvedValue({});

      // Should not throw
      await expect(updateWordScores()).resolves.not.toThrow();
    });

    it('should handle words with no hourly data', async () => {
      const mockWords = [{ member: 'word1', score: 1.0 }];
      vi.mocked(redis.zRange).mockResolvedValueOnce(mockWords);
      vi.mocked(redis.hGetAll).mockResolvedValue({
        // No hourly stats for word1
        'word1:served': '0',
        'word1:picked': '0',
        'word1:posted': '0',
      });

      await expect(updateWordScores()).resolves.not.toThrow();
    });

    it('should prevent division by zero with uniform rates', async () => {
      const mockWords = [
        { member: 'word1', score: 1.0 },
        { member: 'word2', score: 0.5 },
      ];

      vi.mocked(redis.zRange).mockResolvedValueOnce(mockWords);
      vi.mocked(redis.hGetAll).mockResolvedValue({
        // All words have identical rates (should cause std = 0)
        'word1:served': '10',
        'word1:picked': '5',
        'word1:posted': '2',
        'word2:served': '10',
        'word2:picked': '5',
        'word2:posted': '2',
      });

      await expect(updateWordScores()).resolves.not.toThrow();
    });
  });
});
