import { describe, it, expect } from 'vitest';
import { shuffle, binFind } from './array';

describe('array utilities', () => {
  describe('shuffle', () => {
    it('returns array with same length', () => {
      const input = [1, 2, 3, 4, 5];
      const result = shuffle(input);
      expect(result).toHaveLength(input.length);
    });

    it('returns array with same elements', () => {
      const input = [1, 2, 3, 4, 5];
      const result = shuffle(input);
      expect(result.sort()).toEqual(input.sort());
    });

    it('does not mutate original array', () => {
      const input = [1, 2, 3, 4, 5];
      const original = [...input];
      shuffle(input);
      expect(input).toEqual(original);
    });

    it('handles empty array', () => {
      const result = shuffle([]);
      expect(result).toEqual([]);
    });

    it('handles single element array', () => {
      const result = shuffle([42]);
      expect(result).toEqual([42]);
    });

    it('produces different results on multiple calls', () => {
      const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const results = Array.from({ length: 10 }, () => shuffle(input));

      // Check that at least some results are different
      const uniqueResults = new Set(results.map((r) => r.join(',')));
      expect(uniqueResults.size).toBeGreaterThan(1);
    });
  });

  describe('binFind', () => {
    const sortedNumbers = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

    it('finds exact match', () => {
      const result = binFind(sortedNumbers, (n) => n - 7);
      expect(result).toBe(7);
    });

    it('finds element at beginning', () => {
      const result = binFind(sortedNumbers, (n) => n - 1);
      expect(result).toBe(1);
    });

    it('finds element at end', () => {
      const result = binFind(sortedNumbers, (n) => n - 19);
      expect(result).toBe(19);
    });

    it('returns undefined for value not in array', () => {
      const result = binFind(sortedNumbers, (n) => n - 4);
      expect(result).toBe(3); // Returns closest element (3)
    });

    it('returns undefined for value smaller than all elements', () => {
      const result = binFind(sortedNumbers, (n) => n - 0);
      expect(result).toBeUndefined();
    });

    it('returns undefined for value larger than all elements', () => {
      const result = binFind(sortedNumbers, (n) => n - 20);
      expect(result).toBe(19); // Returns last element (19)
    });

    it('handles empty array', () => {
      const result = binFind([], (n) => n - 5);
      expect(result).toBeUndefined();
    });

    it('handles single element array', () => {
      const result = binFind([42], (n) => n - 42);
      expect(result).toBe(42);
    });

    it('works with custom comparison function', () => {
      const strings = ['apple', 'banana', 'cherry', 'date'];
      const result = binFind(strings, (s) => s.localeCompare('banana'));
      expect(result).toBe('banana');
    });

    it('returns closest element when no exact match', () => {
      const result = binFind(sortedNumbers, (n) => n - 6);
      expect(result).toBe(5); // Should return the element at right boundary
    });

    it('works with readonly arrays', () => {
      const readonlyArray = [1, 2, 3, 4, 5] as const;
      const result = binFind(readonlyArray, (n) => n - 3);
      expect(result).toBe(3);
    });
  });
});
