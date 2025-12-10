import { describe, it, expect, vi, beforeEach } from 'vitest';
import { redis, reddit } from '@devvit/web/server';
import { detectDrawingSchemaVersion } from './post';
import { REDIS_KEYS } from '@server/core/redis';

vi.mock('@devvit/web/server', () => ({
  redis: {
    exists: vi.fn(),
    type: vi.fn(),
    hGet: vi.fn(),
  },
  reddit: {
    getPostById: vi.fn(),
  },
}));

vi.mock('@server/core/redis', () => ({
  REDIS_KEYS: {
    drawing: (postId: string) => `drawing:${postId}`,
  },
}));

describe('Migration Post Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectDrawingSchemaVersion', () => {
    it('should return 3 for version 3 drawing post', async () => {
      const postId = 't3_test123';
      const v3Key = REDIS_KEYS.drawing(postId);

      vi.mocked(redis.exists).mockImplementation((key: string) => {
        return Promise.resolve(key === v3Key ? 1 : 0);
      });
      vi.mocked(redis.type).mockResolvedValue('hash');
      vi.mocked(redis.hGet).mockResolvedValue('drawing');

      const version = await detectDrawingSchemaVersion(postId);

      expect(version).toBe(3);
    });

    it('should return 2 for version 2 drawing post', async () => {
      const postId = 't3_test123';
      const v3Key = REDIS_KEYS.drawing(postId);
      const v2Key = `post:${postId}`;

      vi.mocked(redis.exists).mockImplementation((key: string) => {
        return Promise.resolve(key === v2Key ? 1 : 0);
      });
      vi.mocked(redis.type).mockResolvedValue('hash');
      vi.mocked(redis.hGet).mockResolvedValue('drawing');

      const version = await detectDrawingSchemaVersion(postId);

      expect(version).toBe(2);
    });

    it('should return 1 for version 1 drawing post', async () => {
      const postId = 't3_test123';
      const v1Key = `post-${postId}`;

      vi.mocked(redis.exists).mockImplementation((key: string) => {
        return Promise.resolve(key === v1Key ? 1 : 0);
      });
      vi.mocked(redis.type).mockResolvedValue('string');

      const version = await detectDrawingSchemaVersion(postId);

      expect(version).toBe(1);
    });

    it('should return null for non-drawing post (v3 key exists but type is not drawing)', async () => {
      const postId = 't3_test123';
      const v3Key = REDIS_KEYS.drawing(postId);

      vi.mocked(redis.exists).mockImplementation((key: string) => {
        return Promise.resolve(key === v3Key ? 1 : 0);
      });
      vi.mocked(redis.type).mockResolvedValue('hash');
      vi.mocked(redis.hGet).mockResolvedValue('pinned'); // Not a drawing

      const version = await detectDrawingSchemaVersion(postId);

      expect(version).toBeNull();
    });

    it('should return null for non-drawing post (v2 key exists but postType is not drawing)', async () => {
      const postId = 't3_test123';
      const v2Key = `post:${postId}`;

      vi.mocked(redis.exists).mockImplementation((key: string) => {
        return Promise.resolve(key === v2Key ? 1 : 0);
      });
      vi.mocked(redis.type).mockResolvedValue('hash');
      vi.mocked(redis.hGet).mockResolvedValue('pinned'); // Not a drawing

      const version = await detectDrawingSchemaVersion(postId);

      expect(version).toBeNull();
    });

    it('should return null when no schema keys exist', async () => {
      const postId = 't3_test123';

      vi.mocked(redis.exists).mockResolvedValue(0);

      const version = await detectDrawingSchemaVersion(postId);

      expect(version).toBeNull();
    });

    it('should handle v1 key with hash type (migrated but not cleaned)', async () => {
      const postId = 't3_test123';
      const v1Key = `post-${postId}`;

      vi.mocked(redis.exists).mockImplementation((key: string) => {
        return Promise.resolve(key === v1Key ? 1 : 0);
      });
      vi.mocked(redis.type).mockResolvedValue('hash');
      vi.mocked(redis.hGet).mockResolvedValue('drawing'); // Has postType='drawing'

      const version = await detectDrawingSchemaVersion(postId);

      // Should detect as v2 since it's a hash with postType
      expect(version).toBe(2);
    });
  });
});
