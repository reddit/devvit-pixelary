import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { CommandContext } from './comment-commands';
import { processCommand } from './comment-commands';
import * as dictionary from '@server/services/words/dictionary';

// Mock the progression service to return a level 1 user (below level 2 requirement)
const mockGetScore = vi.fn();
const mockGetLevelByScore = vi.fn();

vi.mock('@server/services/progression', () => ({
  getScore: (...args: unknown[]) => mockGetScore(...args),
  getLevelByScore: (...args: unknown[]) => mockGetLevelByScore(...args),
}));

// Mock the dictionary service
vi.mock('@server/services/words/dictionary', () => ({
  addWord: vi.fn().mockResolvedValue(true),
  getBannedWords: vi.fn().mockResolvedValue({
    words: [],
    total: 0,
    hasMore: false,
  }),
  removeWord: vi.fn().mockResolvedValue(true),
  isWordBanned: vi.fn().mockResolvedValue(false),
  isWordInList: vi.fn().mockResolvedValue(false),
}));

// Mock the word-backing service
vi.mock('@server/services/words/word-backing', () => ({
  getBacker: vi.fn().mockResolvedValue(null),
  addBacker: vi.fn().mockResolvedValue(undefined),
  shouldShowWord: vi.fn().mockResolvedValue(false),
}));

// Mock the rewards service
const mockHasReward = vi.fn();

vi.mock('@shared/rewards', () => ({
  hasReward: (...args: unknown[]) => mockHasReward(...args),
}));

describe('Comment command system', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up mocks to return level 1 user (below level 2 requirement)
    mockGetScore.mockResolvedValue(50); // Level 1 user (below level 2)
    mockGetLevelByScore.mockReturnValue({
      rank: 1,
      name: 'Level 1',
      min: 0,
      max: 99,
    });
    mockHasReward.mockImplementation((level: number) => level >= 2);
  });
  const createContext = (
    authorName = 'testuser',
    subredditName = 'testsub',
    postId?: string
  ): CommandContext => ({
    commentId: 'test123' as `t1_${string}`,
    authorName,
    authorId: 'testuser123' as `t2_${string}`,
    subredditName,
    subredditId: 't5_test' as const,
    ...(postId && { postId: postId as `t3_${string}` }),
    timestamp: Date.now(),
  });

  describe('Command routing', () => {
    test('should process valid commands', async () => {
      const context = createContext();
      const result = await processCommand('!help', [], context);

      expect(result.success).toBe(true);
      expect(result.response).toContain(
        'I can respond to the following commands:'
      );
    });

    test('should reject unknown commands', async () => {
      const context = createContext();
      const result = await processCommand('!unknown', [], context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown command');
    });
  });

  describe('Level gates', () => {
    test('should require Level 2 for add/remove commands', async () => {
      const context = createContext();

      const addResult = await processCommand('!add', ['test'], context);
      expect(addResult.success).toBe(false);
      expect(addResult.error).toBe('Requires Level 2 to add words.');

      const removeResult = await processCommand('!remove', ['test'], context);
      expect(removeResult.success).toBe(false);
      expect(removeResult.error).toBe('Requires Level 2 to remove words.');
    });

    test('should handle !show command without postId', async () => {
      const context = createContext('testuser', 'testsub');
      const result = await processCommand('!show', ['testword'], context);

      // !show now works as a backing utility and doesn't require postId
      expect(result.success).toBe(true);
      expect(result.response).toContain('This word is now visible.');
    });
  });

  describe('Command behavior', () => {
    test('should handle stats command without arguments', async () => {
      const context = createContext();
      const result = await processCommand('!stats', [], context);

      expect(result.success).toBe(true);
      expect(result.response).toContain(
        'Provide a word. Usage: `!stats <word>`'
      );
    });

    test('should handle non-existent words gracefully', async () => {
      const context = createContext();
      const result = await processCommand(
        '!stats',
        ['nonexistentword'],
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Word not found');
    });
  });

  describe('Word normalization', () => {
    beforeEach(() => {
      // Set up mocks to return level 2 user (has permission)
      mockGetScore.mockResolvedValue(100); // Level 2 user
      mockGetLevelByScore.mockReturnValue({
        rank: 2,
        name: 'Level 2',
        min: 100,
        max: 199,
      });
      mockHasReward.mockImplementation((level: number) => level >= 2);
      // Ensure mocks are set up correctly after clearAllMocks
      vi.mocked(dictionary.addWord).mockResolvedValue(true);
      vi.mocked(dictionary.removeWord).mockResolvedValue(true);
      vi.mocked(dictionary.getBannedWords).mockResolvedValue({
        words: [],
        total: 0,
        hasMore: false,
      });
    });

    test('should strip !add prefix from word', async () => {
      const context = createContext();
      const result = await processCommand('!add', ['!add', 'test'], context);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Added "test"');
    });

    test('should strip !remove prefix from word', async () => {
      const context = createContext();
      const result = await processCommand(
        '!remove',
        ['!remove', 'test'],
        context
      );

      expect(result.success).toBe(true);
      expect(result.response).toContain('Removed "test"');
    });

    test('should strip special characters except hyphens and spaces', async () => {
      const context = createContext();
      const result = await processCommand('!add', ['word@#$%test'], context);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Added "wordtest"');
    });

    test('should preserve hyphens and spaces', async () => {
      const context = createContext();
      const result = await processCommand('!add', ['hello-world'], context);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Added "hello-world"');
    });

    test('should support multi-word inputs', async () => {
      const context = createContext();
      const result = await processCommand('!add', ['lava', 'lamp'], context);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Added "lava lamp"');
    });

    test('should reject words longer than 12 characters', async () => {
      const context = createContext();
      const result = await processCommand(
        '!add',
        ['thisiswaytoolong'],
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Too long. Max 12 characters.');
    });

    test('should accept words exactly 12 characters', async () => {
      const context = createContext();
      const result = await processCommand('!add', ['123456789012'], context);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Added "123456789012"');
    });

    test('should handle case-insensitive prefix stripping', async () => {
      const context = createContext();
      const result = await processCommand('!add', ['!ADD', 'test'], context);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Added "test"');
    });

    test('should strip prefix anywhere in the string', async () => {
      const context = createContext();
      const result = await processCommand('!add', ['test!add'], context);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Added "test"');
    });

    test('should handle empty word after normalization', async () => {
      const context = createContext();
      const result = await processCommand('!add', ['!add'], context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid word.');
    });
  });
});
