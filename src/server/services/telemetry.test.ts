import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the context
vi.mock('@devvit/web/server', () => ({
  redis: {
    hIncrBy: vi.fn(),
    hGetAll: vi.fn(),
    del: vi.fn(),
  },
}));

import { redis } from '@devvit/web/server';
import {
  getTelemetryDateKey,
  getTelemetryDateKeys,
  trackEvent,
  getEventStats,
  getTodayEventStats,
  getEventStatsRange,
  calculateCTR,
  clearTelemetryData,
} from './telemetry';
import { REDIS_KEYS } from './redis';

describe('Telemetry Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTelemetryDateKey', () => {
    it('should generate date key for current date', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = getTelemetryDateKey(date);

      expect(result).toBe('2024-01-15');
    });

    it('should generate date key for specific date', () => {
      const date = new Date('2023-12-25T23:59:59Z');
      const result = getTelemetryDateKey(date);

      expect(result).toBe('2023-12-25');
    });

    it('should use current date when no date provided', () => {
      const result = getTelemetryDateKey();

      // Should be today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      expect(result).toBe(today);
    });

    it('should handle different timezones correctly', () => {
      const date = new Date('2024-01-15T23:30:00Z');
      const result = getTelemetryDateKey(date);

      expect(result).toBe('2024-01-15');
    });
  });

  describe('getTelemetryDateKeys', () => {
    it('should generate date keys for date range', () => {
      const startDate = new Date('2024-01-15T00:00:00Z');
      const endDate = new Date('2024-01-17T23:59:59Z');

      const result = getTelemetryDateKeys(startDate, endDate);

      expect(result).toEqual(['2024-01-15', '2024-01-16', '2024-01-17']);
    });

    it('should handle single day range', () => {
      const startDate = new Date('2024-01-15T10:00:00Z');
      const endDate = new Date('2024-01-15T20:00:00Z');

      const result = getTelemetryDateKeys(startDate, endDate);

      expect(result).toEqual(['2024-01-15']);
    });

    it('should handle empty range', () => {
      const startDate = new Date('2024-01-15T00:00:00Z');
      const endDate = new Date('2024-01-14T23:59:59Z');

      const result = getTelemetryDateKeys(startDate, endDate);

      expect(result).toEqual([]);
    });

    it('should handle month boundaries', () => {
      const startDate = new Date('2024-01-30T00:00:00Z');
      const endDate = new Date('2024-02-02T23:59:59Z');

      const result = getTelemetryDateKeys(startDate, endDate);

      expect(result).toEqual([
        '2024-01-30',
        '2024-01-31',
        '2024-02-01',
        '2024-02-02',
      ]);
    });
  });

  describe('trackEvent', () => {
    it('should track event with metadata', async () => {
      vi.mocked(redis.hIncrBy).mockResolvedValue(1);

      await trackEvent('drawing', 'view_menu', new Date('2024-01-15'), {
        userId: 'test123',
      });

      expect(redis.hIncrBy).toHaveBeenCalledWith(
        REDIS_KEYS.telemetry('2024-01-15'),
        'drawing:view_menu',
        1
      );
    });

    it('should track event without metadata', async () => {
      vi.mocked(redis.hIncrBy).mockResolvedValue(1);

      await trackEvent('pinned', 'click_draw', new Date('2024-01-15'));

      expect(redis.hIncrBy).toHaveBeenCalledWith(
        REDIS_KEYS.telemetry('2024-01-15'),
        'pinned:click_draw',
        1
      );
    });

    it('should use provided date', async () => {
      const date = new Date('2024-01-20T00:00:00Z');
      vi.mocked(redis.hIncrBy).mockResolvedValue(1);

      await trackEvent('drawing', 'view_menu', date);

      expect(redis.hIncrBy).toHaveBeenCalledWith(
        REDIS_KEYS.telemetry('2024-01-20'),
        'drawing:view_menu',
        1
      );
    });

    it('should handle Redis errors gracefully', async () => {
      vi.mocked(redis.hIncrBy).mockRejectedValue(new Error('Redis error'));

      // Should not throw - telemetry silently handles errors
      await expect(
        trackEvent('drawing', 'view_menu', new Date('2024-01-15'))
      ).resolves.toBeUndefined();
    });
  });

  describe('getEventStats', () => {
    it('should return event stats for specific date', async () => {
      const mockStats = {
        'drawing:view_menu': '5',
        'drawing:click_draw': '3',
        'pinned:view_menu': '2',
      };
      vi.mocked(redis.hGetAll).mockResolvedValue(mockStats);

      const result = await getEventStats('2024-01-15');

      expect(redis.hGetAll).toHaveBeenCalledWith(
        REDIS_KEYS.telemetry('2024-01-15')
      );
      expect(result).toEqual({
        'drawing:view_menu': 5,
        'drawing:click_draw': 3,
        'pinned:view_menu': 2,
      });
    });

    it('should return empty object when no stats exist', async () => {
      vi.mocked(redis.hGetAll).mockResolvedValue({});

      const result = await getEventStats('2024-01-15');

      expect(result).toEqual({});
    });

    it('should filter by post type when provided', async () => {
      const mockStats = {
        'drawing:view_menu': '5',
        'drawing:click_draw': '3',
        'pinned:view_menu': '2',
      };
      vi.mocked(redis.hGetAll).mockResolvedValue(mockStats);

      const result = await getEventStats('2024-01-15', 'drawing');

      expect(result).toEqual({
        'drawing:view_menu': 5,
        'drawing:click_draw': 3,
      });
    });

    it('should handle Redis errors gracefully', async () => {
      vi.mocked(redis.hGetAll).mockRejectedValue(new Error('Redis error'));

      // Should not throw - telemetry silently handles errors
      await expect(getEventStats('2024-01-15')).resolves.toEqual({});
    });
  });

  describe('getTodayEventStats', () => {
    it('should return stats for today', async () => {
      const mockStats = {
        'drawing:view_menu': '5',
        'drawing:click_draw': '3',
      };
      vi.mocked(redis.hGetAll).mockResolvedValue(mockStats);

      const result = await getTodayEventStats();

      const today = new Date().toISOString().split('T')[0];
      expect(redis.hGetAll).toHaveBeenCalledWith(REDIS_KEYS.telemetry(today));
      expect(result).toEqual({
        'drawing:view_menu': 5,
        'drawing:click_draw': 3,
      });
    });

    it('should filter by post type when provided', async () => {
      const mockStats = {
        'drawing:view_menu': '5',
        'pinned:view_menu': '2',
      };
      vi.mocked(redis.hGetAll).mockResolvedValue(mockStats);

      const result = await getTodayEventStats('drawing');

      expect(result).toEqual({
        'drawing:view_menu': 5,
      });
    });
  });

  describe('getEventStatsRange', () => {
    it('should return stats for date range', async () => {
      const mockStats1 = { 'drawing:view_menu': '5' };
      const mockStats2 = { 'drawing:view_menu': '3' };
      const mockStats3 = { 'drawing:view_menu': '2' };

      vi.mocked(redis.hGetAll)
        .mockResolvedValueOnce(mockStats1)
        .mockResolvedValueOnce(mockStats2)
        .mockResolvedValueOnce(mockStats3);

      const startDate = new Date('2024-01-15T00:00:00Z');
      const endDate = new Date('2024-01-17T23:59:59Z');

      const result = await getEventStatsRange(startDate, endDate);

      expect(result).toEqual({
        '2024-01-15': { 'drawing:view_menu': 5 },
        '2024-01-16': { 'drawing:view_menu': 3 },
        '2024-01-17': { 'drawing:view_menu': 2 },
      });
    });

    it('should filter by post type when provided', async () => {
      const mockStats = {
        'drawing:view_menu': '5',
        'pinned:view_menu': '2',
      };
      vi.mocked(redis.hGetAll).mockResolvedValue(mockStats);

      const startDate = new Date('2024-01-15T00:00:00Z');
      const endDate = new Date('2024-01-15T23:59:59Z');

      const result = await getEventStatsRange(startDate, endDate, 'drawing');

      expect(result).toEqual({
        '2024-01-15': { 'drawing:view_menu': 5 },
      });
    });

    it('should handle empty date range', async () => {
      const startDate = new Date('2024-01-15T00:00:00Z');
      const endDate = new Date('2024-01-14T23:59:59Z');

      const result = await getEventStatsRange(startDate, endDate);

      expect(result).toEqual({});
    });
  });

  describe('calculateCTR', () => {
    it('should calculate CTR correctly', async () => {
      const mockStats = {
        'drawing:view_menu': '100',
        'drawing:click_draw': '25',
      };
      vi.mocked(redis.hGetAll).mockResolvedValue(mockStats);

      const result = await calculateCTR(
        '2024-01-15',
        'drawing',
        'view_menu',
        'click_draw'
      );

      expect(result).toBe(0.25); // 25/100 = 0.25
    });

    it('should return 0 when view count is 0', async () => {
      const mockStats = {
        'drawing:view_menu': '0',
        'drawing:click_draw': '5',
      };
      vi.mocked(redis.hGetAll).mockResolvedValue(mockStats);

      const result = await calculateCTR(
        '2024-01-15',
        'drawing',
        'view_menu',
        'click_draw'
      );

      expect(result).toBe(0);
    });

    it('should return 0 when click count is 0', async () => {
      const mockStats = {
        'drawing:view_menu': '100',
        'drawing:click_draw': '0',
      };
      vi.mocked(redis.hGetAll).mockResolvedValue(mockStats);

      const result = await calculateCTR(
        '2024-01-15',
        'drawing',
        'view_menu',
        'click_draw'
      );

      expect(result).toBe(0);
    });

    it('should return 0 when stats do not exist', async () => {
      vi.mocked(redis.hGetAll).mockResolvedValue({});

      const result = await calculateCTR(
        '2024-01-15',
        'drawing',
        'view_menu',
        'click_draw'
      );

      expect(result).toBe(0);
    });

    it('should handle missing view event', async () => {
      const mockStats = {
        'drawing:click_draw': '25',
      };
      vi.mocked(redis.hGetAll).mockResolvedValue(mockStats);

      const result = await calculateCTR(
        '2024-01-15',
        'drawing',
        'view_menu',
        'click_draw'
      );

      expect(result).toBe(0);
    });

    it('should handle missing click event', async () => {
      const mockStats = {
        'drawing:view_menu': '100',
      };
      vi.mocked(redis.hGetAll).mockResolvedValue(mockStats);

      const result = await calculateCTR(
        '2024-01-15',
        'drawing',
        'view_menu',
        'click_draw'
      );

      expect(result).toBe(0);
    });

    it('should handle Redis errors gracefully', async () => {
      vi.mocked(redis.hGetAll).mockRejectedValue(new Error('Redis error'));

      // Should not throw - telemetry silently handles errors
      await expect(
        calculateCTR('2024-01-15', 'drawing', 'view_menu', 'click_draw')
      ).resolves.toBe(0);
    });
  });

  describe('clearTelemetryData', () => {
    it('should clear telemetry data for specific date', async () => {
      vi.mocked(redis.hGetAll).mockResolvedValue({
        'drawing:view_menu': '5',
        'drawing:click_draw': '3',
      });
      vi.mocked(redis.del).mockResolvedValue(1);

      const result = await clearTelemetryData('2024-01-15');

      expect(redis.del).toHaveBeenCalledWith(
        REDIS_KEYS.telemetry('2024-01-15')
      );
      expect(result).toBe(2);
    });

    it('should clear telemetry data for today when no date provided', async () => {
      vi.mocked(redis.hGetAll).mockResolvedValue({
        'drawing:view_menu': '3',
      });
      vi.mocked(redis.del).mockResolvedValue(1);

      const result = await clearTelemetryData();

      const today = new Date().toISOString().split('T')[0];
      expect(redis.del).toHaveBeenCalledWith(REDIS_KEYS.telemetry(today));
      expect(result).toBe(1);
    });

    it('should return 0 when no data exists to clear', async () => {
      vi.mocked(redis.hGetAll).mockResolvedValue({});
      vi.mocked(redis.del).mockResolvedValue(0);

      const result = await clearTelemetryData('2024-01-15');

      expect(result).toBe(0);
    });

    it('should handle Redis errors gracefully', async () => {
      vi.mocked(redis.hGetAll).mockRejectedValue(new Error('Redis error'));

      // Should not throw - telemetry silently handles errors
      await expect(clearTelemetryData('2024-01-15')).resolves.toBe(0);
    });
  });
});
