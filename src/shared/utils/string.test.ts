import { describe, it, expect } from 'vitest';
import { obfuscateString, titleCase, normalizeWord } from './string';

describe('string utilities', () => {
  describe('obfuscateString', () => {
    it('obfuscates strings longer than 2 characters', () => {
      expect(obfuscateString('hello')).toBe('h***o');
      expect(obfuscateString('test')).toBe('t**t');
      expect(obfuscateString('password')).toBe('p******d');
      expect(obfuscateString('username')).toBe('u******e');
    });

    it('handles strings of length 2 or less', () => {
      expect(obfuscateString('ab')).toBe('**');
      expect(obfuscateString('a')).toBe('*');
      expect(obfuscateString('')).toBe('');
    });

    it('preserves first and last characters', () => {
      expect(obfuscateString('hello')).toBe('h***o');
      expect(obfuscateString('test')).toBe('t**t');
      expect(obfuscateString('abcdefgh')).toBe('a******h');
    });

    it('handles special characters', () => {
      expect(obfuscateString('test@123')).toBe('t******3');
      expect(obfuscateString('user-name')).toBe('u*******e');
      expect(obfuscateString('hello!')).toBe('h****!');
    });

    it('handles unicode characters', () => {
      expect(obfuscateString('héllo')).toBe('h***o');
      expect(obfuscateString('测试')).toBe('**'); // 2 characters, so fully obfuscated
      // Test that emoji characters are handled (may be corrupted in test environment)
      const result = obfuscateString('🚀test🚀');
      expect(result).toMatch(/^.{1}\*{6}.{1}$/); // First char, 6 asterisks, last char
    });

    it('handles whitespace', () => {
      expect(obfuscateString('hello world')).toBe('h*********d');
      expect(obfuscateString('  test  ')).toBe(' ****** ');
    });

    it('handles edge cases', () => {
      expect(obfuscateString('a')).toBe('*');
      expect(obfuscateString('ab')).toBe('**');
      expect(obfuscateString('abc')).toBe('a*c');
      expect(obfuscateString('abcd')).toBe('a**d');
    });
  });

  describe('titleCase', () => {
    it('capitalizes first letter of each word', () => {
      expect(titleCase('hello world')).toBe('Hello World');
      expect(titleCase('this is a test')).toBe('This Is A Test');
      expect(titleCase('multiple   spaces')).toBe('Multiple   Spaces');
    });

    it('handles single words', () => {
      expect(titleCase('hello')).toBe('Hello');
      expect(titleCase('WORLD')).toBe('World');
      expect(titleCase('test')).toBe('Test');
    });

    it('handles empty string', () => {
      expect(titleCase('')).toBe('');
    });

    it('handles already title cased strings', () => {
      expect(titleCase('Hello World')).toBe('Hello World');
      expect(titleCase('This Is A Test')).toBe('This Is A Test');
    });

    it('handles all uppercase strings', () => {
      expect(titleCase('HELLO WORLD')).toBe('Hello World');
      expect(titleCase('THIS IS A TEST')).toBe('This Is A Test');
    });

    it('handles mixed case strings', () => {
      expect(titleCase('hELLo WoRLd')).toBe('Hello World');
      expect(titleCase('tHiS iS a TeSt')).toBe('This Is A Test');
    });

    it('handles strings with special characters', () => {
      expect(titleCase('hello-world')).toBe('Hello-world');
      expect(titleCase('test@email.com')).toBe('Test@email.com');
      expect(titleCase('user_name')).toBe('User_name');
    });

    it('handles strings with numbers', () => {
      expect(titleCase('test123')).toBe('Test123');
      expect(titleCase('hello 123 world')).toBe('Hello 123 World');
    });

    it('handles multiple spaces', () => {
      expect(titleCase('hello    world')).toBe('Hello    World');
      expect(titleCase('  test  ')).toBe('  Test  ');
    });

    it('handles unicode characters', () => {
      expect(titleCase('héllo wörld')).toBe('Héllo Wörld');
      expect(titleCase('测试 世界')).toBe('测试 世界');
    });
  });

  describe('normalizeWord', () => {
    it('trims whitespace and converts to title case', () => {
      expect(normalizeWord('  hello world  ')).toBe('Hello World');
      expect(normalizeWord('  test  ')).toBe('Test');
      expect(normalizeWord('\thello\n')).toBe('Hello');
    });

    it('handles already normalized words', () => {
      expect(normalizeWord('Hello World')).toBe('Hello World');
      expect(normalizeWord('Test')).toBe('Test');
    });

    it('handles empty string', () => {
      expect(normalizeWord('')).toBe('');
    });

    it('handles whitespace only strings', () => {
      expect(normalizeWord('   ')).toBe('');
      expect(normalizeWord('\t\n')).toBe('');
    });

    it('handles single words', () => {
      expect(normalizeWord('hello')).toBe('Hello');
      expect(normalizeWord('  world  ')).toBe('World');
      expect(normalizeWord('TEST')).toBe('Test');
    });

    it('handles mixed case with whitespace', () => {
      expect(normalizeWord('  hELLo WoRLd  ')).toBe('Hello World');
      expect(normalizeWord('\ttHiS iS a TeSt\n')).toBe('This Is A Test');
    });

    it('handles special characters', () => {
      expect(normalizeWord('  hello-world  ')).toBe('Hello-world');
      expect(normalizeWord('  test@email.com  ')).toBe('Test@email.com');
    });

    it('handles unicode characters', () => {
      expect(normalizeWord('  héllo wörld  ')).toBe('Héllo Wörld');
      expect(normalizeWord('  测试 世界  ')).toBe('测试 世界');
    });

    it('handles multiple internal spaces', () => {
      expect(normalizeWord('  hello    world  ')).toBe('Hello    World');
      expect(normalizeWord('  test   with   spaces  ')).toBe(
        'Test   With   Spaces'
      );
    });

    it('handles edge cases', () => {
      expect(normalizeWord('a')).toBe('A');
      expect(normalizeWord('  a  ')).toBe('A');
      expect(normalizeWord('123')).toBe('123');
      expect(normalizeWord('  hello123world  ')).toBe('Hello123world');
    });
  });
});
