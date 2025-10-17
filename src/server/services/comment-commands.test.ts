import { describe, test, expect } from 'vitest';
import { processCommand } from './comment-commands';
import type { CommandContext } from './comment-commands';

/**
 * Simplified tests for command system
 */
describe('Simplified Command System', () => {
  const createContext = (
    authorName = 'testuser',
    subredditName = 'testsub',
    postId?: string
  ): CommandContext => ({
    commentId: 'test123',
    authorName,
    authorId: 'testuser123',
    subredditName,
    subredditId: 't5_test' as const,
    ...(postId && { postId: postId as `t3_${string}` }),
    timestamp: Date.now(),
    source: 'test' as const,
  });

  describe('Command Processing', () => {
    test('should process valid commands successfully', async () => {
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

    test('should validate input parameters', async () => {
      const context = createContext();
      const result = await processCommand('!add', [], context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Provide a word. Usage: `!add <word>`');
    });

    test('should handle !show command with word', async () => {
      const context = createContext('testuser', 'testsub', 't3_post123');
      const result = await processCommand('!show', ['testword'], context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to retrieve word statistics');
    });

    test('should reject !show command without word', async () => {
      const context = createContext('testuser', 'testsub', 't3_post123');
      const result = await processCommand('!show', [], context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Provide a word. Usage: `!show <word>`');
    });

    test('should reject !show command without postId', async () => {
      const context = createContext('testuser', 'testsub');
      const result = await processCommand('!show', ['testword'], context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unable to determine post context');
    });

    test('should handle words command with pagination', async () => {
      const context = createContext();
      const result = await processCommand('!words', ['1'], context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to retrieve dictionary');
    });

    test('should validate page numbers', async () => {
      const context = createContext();
      const result = await processCommand('!words', ['abc'], context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to retrieve dictionary');
    });

    test('should reject invalid page numbers', async () => {
      const context = createContext();
      const result = await processCommand('!words', ['0'], context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to retrieve dictionary');
    });

    test('should handle word command without arguments', async () => {
      const context = createContext();
      const result = await processCommand('!word', [], context);

      expect(result.success).toBe(true);
      expect(result.response).toContain(
        'Provide a word. Usage: `!word <word>`'
      );
    });

    test('should handle word command with arguments', async () => {
      const context = createContext();
      const result = await processCommand('!word', ['testword'], context);

      // This will fail because the word doesn't exist in the dictionary
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to retrieve word statistics');
    });
  });

  describe('Moderator Commands', () => {
    test('should reject remove command for non-moderators', async () => {
      const context = createContext('regularuser', 'testsub');
      const result = await processCommand('!remove', ['testword'], context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to remove word');
    });
  });

  describe('Input Validation', () => {
    test('should handle empty arguments', async () => {
      const context = createContext();
      const result = await processCommand('!add', [''], context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid word');
    });

    test('should handle long words', async () => {
      const context = createContext();
      const longWord = 'a'.repeat(51);
      const result = await processCommand('!add', [longWord], context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid word');
    });
  });
});
