import { describe, test, expect } from 'vitest';
import { processCommand } from './comment-commands';
import type { CommandContext } from './comment-commands';

/**
 * Simplified tests for command system
 */
describe('Simplified Command System', () => {
  const createContext = (
    authorName = 'testuser',
    subredditName = 'testsub'
  ): CommandContext => ({
    commentId: 'test123',
    authorName,
    authorId: 'testuser123',
    subredditName,
    subredditId: 't5_test' as const,
    timestamp: Date.now(),
    source: 'test' as const,
  });

  describe('Command Processing', () => {
    test('should process valid commands successfully', async () => {
      const context = createContext();
      const result = await processCommand('!help', [], context);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Pixelary Commands');
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
      expect(result.error).toContain('Please provide a word');
    });

    test('should handle words command with pagination', async () => {
      const context = createContext();
      const result = await processCommand('!words', ['1'], context);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Dictionary');
    });

    test('should validate page numbers', async () => {
      const context = createContext();
      const result = await processCommand('!words', ['abc'], context);

      expect(result.success).toBe(true); // Should default to page 1
    });

    test('should reject invalid page numbers', async () => {
      const context = createContext();
      const result = await processCommand('!words', ['0'], context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid page number');
    });

    test('should handle word command without arguments', async () => {
      const context = createContext();
      const result = await processCommand('!word', [], context);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Please provide a word');
      expect(result.response).toContain('!word <word>');
    });

    test('should handle word command with arguments', async () => {
      const context = createContext();
      const result = await processCommand('!word', ['testword'], context);

      // This will fail because the word doesn't exist in the dictionary
      expect(result.success).toBe(false);
      expect(result.error).toContain('not in the dictionary');
    });
  });

  describe('Moderator Commands', () => {
    test('should reject remove command for non-moderators', async () => {
      const context = createContext('regularuser', 'testsub');
      const result = await processCommand('!remove', ['testword'], context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient permissions');
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
