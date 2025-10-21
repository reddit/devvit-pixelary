import { describe, test, expect } from 'vitest';
import { processCommand } from './comment-commands';
import type { CommandContext } from './comment-commands';

describe('Comment command system', () => {
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

  describe('Parameter validation', () => {
    test('should require arguments for commands that need them', async () => {
      const context = createContext();

      const addResult = await processCommand('!add', [], context);
      expect(addResult.success).toBe(false);
      expect(addResult.error).toContain('Provide a word. Usage: `!add <word>`');

      const showResult = await processCommand('!show', [], context);
      expect(showResult.success).toBe(false);
      expect(showResult.error).toContain(
        'Provide a word. Usage: `!show <word>`'
      );
    });

    test('should validate word format', async () => {
      const context = createContext();

      const emptyResult = await processCommand('!add', [''], context);
      expect(emptyResult.success).toBe(false);
      expect(emptyResult.error).toContain('Invalid word');

      const longWord = 'a'.repeat(51);
      const longResult = await processCommand('!add', [longWord], context);
      expect(longResult.success).toBe(false);
      expect(longResult.error).toContain('Invalid word');
    });

    test('should require postId for !show command', async () => {
      const context = createContext('testuser', 'testsub');
      const result = await processCommand('!show', ['testword'], context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unable to determine post context');
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
      expect(result.error).toContain('Failed to retrieve word statistics');
    });
  });
});
