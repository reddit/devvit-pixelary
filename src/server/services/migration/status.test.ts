import { describe, it, expect, vi, beforeEach } from 'vitest';
import { redis } from '@devvit/web/server';
import {
  getMigrationStatus,
  setMigrationEnabled,
  setMigrationBatchSize,
  getMigrationBatchSize,
  ENABLED_KEY,
  BATCH_SIZE_KEY,
  PROCESSED_COUNT_KEY,
  SUCCESS_COUNT_KEY,
  FAILED_COUNT_KEY,
  MIGRATED_COUNT_KEY,
  MIGRATION_FAILED_KEY,
  MIGRATION_SKIPPED_KEY,
  BEFORE_ANCHOR_KEY,
  LOCK_KEY,
} from './status';

vi.mock('@devvit/web/server', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    exists: vi.fn(),
    zCard: vi.fn(),
  },
}));

describe('Migration Status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMigrationStatus', () => {
    it('should return default values when keys do not exist', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(redis.exists).mockResolvedValue(0);
      vi.mocked(redis.zCard).mockResolvedValue(0);

      const status = await getMigrationStatus();

      expect(status).toEqual({
        enabled: false, // Defaults to false when key doesn't exist
        batchSize: 100, // Defaults to 100 when key doesn't exist
        processed: 0,
        succeeded: 0,
        failed: 0,
        migrated: 0,
        pendingFailed: 0,
        skipped: 0,
        beforeAnchor: null,
        isLocked: false,
      });
    });

    it('should return correct values when migration is enabled', async () => {
      vi.mocked(redis.get).mockImplementation((key: string) => {
        const values: Record<string, string | null> = {
          [ENABLED_KEY]: 'true',
          [BATCH_SIZE_KEY]: '50',
          [PROCESSED_COUNT_KEY]: '150',
          [SUCCESS_COUNT_KEY]: '140',
          [FAILED_COUNT_KEY]: '10',
          [MIGRATED_COUNT_KEY]: '135',
          [BEFORE_ANCHOR_KEY]: 't3_anchor123',
        };
        return Promise.resolve(values[key] ?? null);
      });
      vi.mocked(redis.exists).mockResolvedValue(1); // Lock exists
      vi.mocked(redis.zCard).mockImplementation((key: string) => {
        const counts: Record<string, number> = {
          [MIGRATION_FAILED_KEY]: 5,
          [MIGRATION_SKIPPED_KEY]: 2,
        };
        return Promise.resolve(counts[key] ?? 0);
      });

      const status = await getMigrationStatus();

      expect(status).toEqual({
        enabled: true,
        batchSize: 50,
        processed: 150,
        succeeded: 140,
        failed: 10,
        migrated: 135,
        pendingFailed: 5,
        skipped: 2,
        beforeAnchor: 't3_anchor123',
        isLocked: true,
      });
    });

    it('should return disabled when enabled key is false', async () => {
      vi.mocked(redis.get).mockImplementation((key: string) => {
        if (key === ENABLED_KEY) return Promise.resolve('false');
        return Promise.resolve(null);
      });
      vi.mocked(redis.exists).mockResolvedValue(0);
      vi.mocked(redis.zCard).mockResolvedValue(0);

      const status = await getMigrationStatus();

      expect(status.enabled).toBe(false);
    });

    it('should handle missing count keys gracefully', async () => {
      vi.mocked(redis.get).mockImplementation((key: string) => {
        if (key === ENABLED_KEY) return Promise.resolve('true');
        // All count keys return null
        return Promise.resolve(null);
      });
      vi.mocked(redis.exists).mockResolvedValue(0);
      vi.mocked(redis.zCard).mockResolvedValue(0);

      const status = await getMigrationStatus();

      expect(status.batchSize).toBe(100); // Defaults to 100
      expect(status.processed).toBe(0);
      expect(status.succeeded).toBe(0);
      expect(status.failed).toBe(0);
      expect(status.migrated).toBe(0);
    });
  });

  describe('setMigrationEnabled', () => {
    it('should set enabled to true', async () => {
      vi.mocked(redis.set).mockResolvedValue(undefined);

      await setMigrationEnabled(true);

      expect(redis.set).toHaveBeenCalledWith(ENABLED_KEY, 'true');
    });

    it('should set enabled to false', async () => {
      vi.mocked(redis.set).mockResolvedValue(undefined);

      await setMigrationEnabled(false);

      expect(redis.set).toHaveBeenCalledWith(ENABLED_KEY, 'false');
    });
  });

  describe('setMigrationBatchSize', () => {
    it('should set batch size to specified value', async () => {
      vi.mocked(redis.set).mockResolvedValue(undefined);

      await setMigrationBatchSize(50);

      expect(redis.set).toHaveBeenCalledWith(BATCH_SIZE_KEY, '50');
    });

    it('should clamp batch size to minimum of 1', async () => {
      vi.mocked(redis.set).mockResolvedValue(undefined);

      await setMigrationBatchSize(0);

      expect(redis.set).toHaveBeenCalledWith(BATCH_SIZE_KEY, '1');
    });

    it('should clamp batch size to maximum of 100', async () => {
      vi.mocked(redis.set).mockResolvedValue(undefined);

      await setMigrationBatchSize(200);

      expect(redis.set).toHaveBeenCalledWith(BATCH_SIZE_KEY, '100');
    });
  });

  describe('getMigrationBatchSize', () => {
    it('should return default batch size when key does not exist', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);

      const batchSize = await getMigrationBatchSize();

      expect(batchSize).toBe(100);
    });

    it('should return stored batch size when key exists', async () => {
      vi.mocked(redis.get).mockResolvedValue('75');

      const batchSize = await getMigrationBatchSize();

      expect(batchSize).toBe(75);
    });
  });
});
