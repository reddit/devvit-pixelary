import { describe, test, expect } from 'vitest';
import { SecurityValidator } from './security';

describe('SecurityValidator', () => {
  describe('validateWord', () => {
    test('should accept valid words', () => {
      const validWords = ['hello', 'world', 'test-word', 'word123'];

      validWords.forEach((word) => {
        const result = SecurityValidator.validateWord(word);
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe(word);
      });
    });

    test('should reject empty or invalid words', () => {
      const invalidWords = ['', '   ', null, undefined, 'a'.repeat(51)];

      invalidWords.forEach((word) => {
        const result = SecurityValidator.validateWord(word as string);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    test('should reject words with invalid characters', () => {
      const invalidWords = [
        '<script>alert("xss")</script>',
        'word@#$%',
        'word<script>',
        'word&nbsp;',
        'word"quotes"',
        "word'single'",
      ];

      invalidWords.forEach((word) => {
        const result = SecurityValidator.validateWord(word);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('invalid');
      });
    });

    test('should reject words with suspicious patterns', () => {
      const suspiciousWords = [
        'javascript:alert("xss")',
        'eval(something)',
        'function()',
        'import os',
        'require("fs")',
        'process.exit()',
      ];

      suspiciousWords.forEach((word) => {
        const result = SecurityValidator.validateWord(word);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('invalid content');
      });
    });
  });

  describe('validatePageNumber', () => {
    test('should accept valid page numbers', () => {
      const validPages = ['1', '5', '100', '1000'];

      validPages.forEach((page) => {
        const result = SecurityValidator.validatePageNumber(page);
        expect(result.valid).toBe(true);
        expect(result.page).toBe(parseInt(page));
      });
    });

    test('should default to page 1 for empty input', () => {
      const result = SecurityValidator.validatePageNumber('');
      expect(result.valid).toBe(true);
      expect(result.page).toBe(1);
    });

    test('should reject invalid page numbers', () => {
      const invalidPages = ['abc', '0', '-1', '1001', '1.5'];

      invalidPages.forEach((page) => {
        const result = SecurityValidator.validatePageNumber(page);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('validateCommandInput', () => {
    test('should accept valid command input', () => {
      const context = {
        authorName: 'testuser',
        subredditName: 'testsub',
      };

      const result = SecurityValidator.validateCommandInput(
        '!add',
        ['hello', 'world'],
        context
      );

      expect(result.valid).toBe(true);
      expect(result.sanitizedArgs).toEqual(['hello', 'world']);
    });

    test('should reject commands that are too long', () => {
      const context = {
        authorName: 'testuser',
        subredditName: 'testsub',
      };

      const longCommand = '!'.repeat(1001);
      const result = SecurityValidator.validateCommandInput(
        longCommand,
        ['hello'],
        context
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Command too long');
    });

    test('should reject too many arguments', () => {
      const context = {
        authorName: 'testuser',
        subredditName: 'testsub',
      };

      const manyArgs = Array(11).fill('arg');
      const result = SecurityValidator.validateCommandInput(
        '!add',
        manyArgs,
        context
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Too many arguments');
    });

    test('should reject invalid usernames', () => {
      const context = {
        authorName: 'ab', // Too short
        subredditName: 'testsub',
      };

      const result = SecurityValidator.validateCommandInput(
        '!add',
        ['hello'],
        context
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid username');
    });

    test('should reject invalid subreddit names', () => {
      const context = {
        authorName: 'testuser',
        subredditName: 'ab', // Too short
      };

      const result = SecurityValidator.validateCommandInput(
        '!add',
        ['hello'],
        context
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid subreddit name');
    });
  });

  describe('checkForAbuse', () => {
    test('should not flag normal usage as abuse', async () => {
      const result = await SecurityValidator.checkForAbuse(
        'testuser',
        'testsub',
        '!help'
      );

      expect(result.isAbuse).toBe(false);
    });

    test('should detect repeated command execution', async () => {
      const authorName = 'abusetest';
      const subredditName = 'testsub';
      const command = '!help';

      // Simulate repeated commands
      for (let i = 0; i < 6; i++) {
        await SecurityValidator.checkForAbuse(
          authorName,
          subredditName,
          command
        );
      }

      const result = await SecurityValidator.checkForAbuse(
        authorName,
        subredditName,
        command
      );

      expect(result.isAbuse).toBe(true);
      expect(result.reason).toBe('Repeated command execution');
    });
  });
});
