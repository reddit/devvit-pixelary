import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Redis before importing the module
vi.mock('@devvit/web/server', () => ({
  redis: {
    hSet: vi.fn(),
    hGet: vi.fn(),
    hDel: vi.fn(),
    hGetAll: vi.fn(),
    keys: vi.fn(),
  },
}));

vi.mock('./dictionary', () => ({
  getBannedWords: vi.fn(),
  banWord: vi.fn(),
}));

// Import after mocking
import { redis } from '@devvit/web/server';
import {
  setChampionComment,
  getChampionComment,
  removeChampionComment,
  getAllChampionWords,
  isWordBanned,
  findChampionCommentByCommentId,
} from './champion-comments';
import { REDIS_KEYS } from './redis';
import { banWord } from './dictionary';

describe('Champion Comments Service', () => {
  const postId = 't3_test123' as const;
  const word = 'testword';
  const commentId = 't1_comment123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setChampionComment', () => {
    it('should store champion comment reference', async () => {
      vi.mocked(redis.hSet).mockResolvedValue(1);

      await setChampionComment(postId, word, commentId);

      expect(redis.hSet).toHaveBeenCalledWith(
        REDIS_KEYS.championComments(postId),
        { [word.toLowerCase()]: commentId }
      );
    });
  });

  describe('getChampionComment', () => {
    it('should retrieve champion comment ID', async () => {
      vi.mocked(redis.hGet).mockResolvedValue(commentId);

      const result = await getChampionComment(postId, word);

      expect(redis.hGet).toHaveBeenCalledWith(
        REDIS_KEYS.championComments(postId),
        word.toLowerCase()
      );
      expect(result).toBe(commentId);
    });

    it('should return null if no champion comment exists', async () => {
      vi.mocked(redis.hGet).mockResolvedValue(null);

      const result = await getChampionComment(postId, word);

      expect(result).toBeNull();
    });
  });

  describe('removeChampionComment', () => {
    it('should remove champion comment reference', async () => {
      vi.mocked(redis.hDel).mockResolvedValue(1);

      await removeChampionComment(postId, word);

      expect(redis.hDel).toHaveBeenCalledWith(
        REDIS_KEYS.championComments(postId),
        word.toLowerCase()
      );
    });
  });

  describe('getAllChampionWords', () => {
    it('should return all champion words for a post', async () => {
      const championData = {
        'word1': 'comment1',
        'word2': 'comment2',
      };
      vi.mocked(redis.hGetAll).mockResolvedValue(championData);

      const result = await getAllChampionWords(postId);

      expect(redis.hGetAll).toHaveBeenCalledWith(
        REDIS_KEYS.championComments(postId)
      );
      expect(result).toEqual(['word1', 'word2']);
    });
  });

  describe('findChampionCommentByCommentId', () => {
    it('should find champion comment by comment ID', async () => {
      vi.mocked(redis.keys).mockResolvedValue([
        'champions:t3_post1',
        'champions:t3_post2',
      ]);
      vi.mocked(redis.hGetAll)
        .mockResolvedValueOnce({ 'word1': 'comment1', 'word2': commentId })
        .mockResolvedValueOnce({ 'word3': 'comment3' });

      const result = await findChampionCommentByCommentId(commentId);

      expect(result).toEqual({
        postId: 't3_post1',
        word: 'word2',
      });
    });

    it('should return null if champion comment not found', async () => {
      vi.mocked(redis.keys).mockResolvedValue(['champions:t3_post1']);
      vi.mocked(redis.hGetAll).mockResolvedValue({ 'word1': 'comment1' });

      const result = await findChampionCommentByCommentId('nonexistent');

      expect(result).toBeNull();
    });
  });
});
