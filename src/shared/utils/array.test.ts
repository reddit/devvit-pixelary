import { describe, it, expect } from 'vitest';
import { shuffle } from './array';

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
});
