import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the context
vi.mock('@devvit/web/server', () => ({
  context: {
    subredditName: 'testsub',
  },
  redis: {
    zAdd: vi.fn(),
    zRem: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    get: vi.fn(),
  },
}));

// Mock the dictionary service
vi.mock('./dictionary', () => ({
  isWordBanned: vi.fn().mockResolvedValue(false),
}));

import { redis } from '@devvit/web/server';
import { addBacker, getBacker, removeBacker } from './word-backing';
import { REDIS_KEYS } from './redis';

describe('Word Backing Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addBacker', () => {
    it('should set a new backing for a word', async () => {
      const word = 'test';
      const commentId = 't1_comment123' as const;

      vi.mocked(redis.zAdd).mockResolvedValue(1);
      vi.mocked(redis.set).mockResolvedValue('OK');
      vi.mocked(redis.del).mockResolvedValue(0);

      await addBacker(word, commentId);

      expect(redis.set).toHaveBeenCalledWith(
        REDIS_KEYS.wordBacking('Test'),
        commentId
      );
      expect(redis.set).toHaveBeenCalledWith(
        REDIS_KEYS.wordBackingComment(commentId),
        'Test'
      );
    });

    it('should replace existing backing and clean up previous backing', async () => {
      const word = 'test';
      const commentId = 't1_comment123' as const;
      const previousCommentId = 't1_previous123' as const;

      // Mock getBacker to return a previous backing
      vi.mocked(redis.get).mockImplementation((key) => {
        if (key === REDIS_KEYS.wordBacking('Test')) {
          return Promise.resolve(previousCommentId);
        }
        return Promise.resolve(null);
      });

      vi.mocked(redis.zAdd).mockResolvedValue(1);
      vi.mocked(redis.set).mockResolvedValue('OK');
      vi.mocked(redis.del).mockResolvedValue(1);

      await addBacker(word, commentId);

      expect(redis.del).toHaveBeenCalledWith(
        REDIS_KEYS.wordBackingComment(previousCommentId)
      );
    });

    it('should not set backing if word is banned', async () => {
      const word = 'banned';
      const commentId = 't1_comment123' as const;

      // Mock isWordBanned to return true for the normalized word
      const { isWordBanned } = await import('./dictionary');
      vi.mocked(isWordBanned).mockResolvedValue(true);

      await addBacker(word, commentId);

      expect(redis.zAdd).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('should handle Redis errors', async () => {
      const word = 'test';
      const commentId = 't1_comment123' as const;

      vi.mocked(redis.set).mockRejectedValue(new Error('Redis error'));

      await expect(addBacker(word, commentId)).rejects.toThrow('Redis error');
    });
  });

  describe('getBacker', () => {
    it('should return backing comment ID for a word', async () => {
      const word = 'test';
      const commentId = 't1_comment123' as const;

      vi.mocked(redis.get).mockResolvedValue(commentId);

      const result = await getBacker(word);

      expect(redis.get).toHaveBeenCalledWith(REDIS_KEYS.wordBacking('Test'));
      expect(result).toBe(commentId);
    });

    it('should return null if no backing exists', async () => {
      const word = 'test';

      vi.mocked(redis.get).mockResolvedValue(null);

      const result = await getBacker(word);

      expect(result).toBeNull();
    });

    it('should return null if backing ID is invalid', async () => {
      const word = 'test';

      vi.mocked(redis.get).mockResolvedValue('invalid_id');

      const result = await getBacker(word);

      expect(result).toBeNull();
    });

    it('should normalize word before lookup', async () => {
      const word = 'TEST';
      const commentId = 't1_comment123' as const;

      vi.mocked(redis.get).mockResolvedValue(commentId);

      await getBacker(word);

      expect(redis.get).toHaveBeenCalledWith(REDIS_KEYS.wordBacking('Test'));
    });
  });

  describe('removeBacker', () => {
    it('should remove backing and clean up all related keys', async () => {
      const word = 'test';
      const commentId = 't1_comment123' as const;

      vi.mocked(redis.get).mockResolvedValue(commentId);
      vi.mocked(redis.zRem).mockResolvedValue(1);
      vi.mocked(redis.del).mockResolvedValue(1);

      await removeBacker(word);

      expect(redis.del).toHaveBeenCalledWith(REDIS_KEYS.wordBacking('Test'));
      expect(redis.del).toHaveBeenCalledWith(
        REDIS_KEYS.wordBackingComment(commentId)
      );
    });

    it('should handle case when no backing exists', async () => {
      const word = 'test';

      vi.mocked(redis.get).mockResolvedValue(null);

      await removeBacker(word);

      expect(redis.zRem).not.toHaveBeenCalled();
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('should normalize word before removal', async () => {
      const word = 'TEST';
      const commentId = 't1_comment123' as const;

      vi.mocked(redis.get).mockResolvedValue(commentId);
      vi.mocked(redis.zRem).mockResolvedValue(1);
      vi.mocked(redis.del).mockResolvedValue(1);

      await removeBacker(word);

      expect(redis.del).toHaveBeenCalledWith(REDIS_KEYS.wordBacking('Test'));
      expect(redis.del).toHaveBeenCalledWith(
        REDIS_KEYS.wordBackingComment(commentId)
      );
    });
  });
});
