import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Redis before importing the module
vi.mock('@devvit/web/server', () => ({
  redis: {
    hSet: vi.fn(),
    hGet: vi.fn(),
    hDel: vi.fn(),
    hGetAll: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
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
  const subredditName = 'testsub';
  const word = 'testword';
  const commentId = 't1_comment123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setChampionComment', () => {
    it('should store champion comment reference', async () => {
      vi.mocked(redis.get).mockResolvedValueOnce('[]'); // getAllChampionWords returns empty array
      vi.mocked(redis.set).mockResolvedValue('OK');

      await setChampionComment(subredditName, word, commentId);

      expect(redis.get).toHaveBeenCalledWith(
        REDIS_KEYS.wordsChampioned(subredditName)
      );
      expect(redis.set).toHaveBeenCalledWith(
        REDIS_KEYS.wordsChampioned(subredditName),
        JSON.stringify([word.toLowerCase()])
      );
      expect(redis.set).toHaveBeenCalledWith(
        REDIS_KEYS.wordChampion(word.toLowerCase()),
        commentId
      );
      expect(redis.set).toHaveBeenCalledWith(
        REDIS_KEYS.championWord(commentId),
        JSON.stringify({ subredditName, word })
      );
    });
  });

  describe('getChampionComment', () => {
    it('should retrieve champion comment ID', async () => {
      vi.mocked(redis.get).mockResolvedValue(commentId);

      const result = await getChampionComment(word);

      expect(redis.get).toHaveBeenCalledWith(
        REDIS_KEYS.wordChampion(word.toLowerCase())
      );
      expect(result).toBe(commentId);
    });

    it('should return null if no champion comment exists', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);

      const result = await getChampionComment(word);

      expect(result).toBeNull();
    });
  });

  describe('removeChampionComment', () => {
    it('should remove champion comment reference', async () => {
      vi.mocked(redis.get)
        .mockResolvedValueOnce(commentId) // get commentId
        .mockResolvedValueOnce(JSON.stringify([word.toLowerCase()])); // getAllChampionWords
      vi.mocked(redis.set).mockResolvedValue('OK');
      vi.mocked(redis.del).mockResolvedValue(1);

      await removeChampionComment(subredditName, word);

      expect(redis.get).toHaveBeenCalledWith(
        REDIS_KEYS.wordChampion(word.toLowerCase())
      );
      expect(redis.get).toHaveBeenCalledWith(
        REDIS_KEYS.wordsChampioned(subredditName)
      );
      expect(redis.set).toHaveBeenCalledWith(
        REDIS_KEYS.wordsChampioned(subredditName),
        JSON.stringify([])
      );
      expect(redis.del).toHaveBeenCalledWith(
        REDIS_KEYS.wordChampion(word.toLowerCase())
      );
      expect(redis.del).toHaveBeenCalledWith(
        REDIS_KEYS.championWord(commentId)
      );
    });
  });

  describe('getAllChampionWords', () => {
    it('should return all champion words for a subreddit', async () => {
      const wordsChampioned = ['word1', 'word2'];
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(wordsChampioned));

      const result = await getAllChampionWords(subredditName);

      expect(redis.get).toHaveBeenCalledWith(
        REDIS_KEYS.wordsChampioned(subredditName)
      );
      expect(result).toEqual(wordsChampioned);
    });

    it('should return empty array if no champion words exist', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);

      const result = await getAllChampionWords(subredditName);

      expect(result).toEqual([]);
    });
  });

  describe('findChampionCommentByCommentId', () => {
    it('should find champion comment by comment ID', async () => {
      const reverseData = JSON.stringify({
        subredditName: 'testsub',
        word: 'word2',
      });
      vi.mocked(redis.get).mockResolvedValue(reverseData);

      const result = await findChampionCommentByCommentId(commentId);

      expect(redis.get).toHaveBeenCalledWith(
        REDIS_KEYS.championWord(commentId)
      );
      expect(result).toEqual({
        subredditName: 'testsub',
        word: 'word2',
      });
    });

    it('should return null if champion comment not found', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);

      const result = await findChampionCommentByCommentId('nonexistent');

      expect(redis.get).toHaveBeenCalledWith(
        REDIS_KEYS.championWord('nonexistent')
      );
      expect(result).toBeNull();
    });
  });
});
