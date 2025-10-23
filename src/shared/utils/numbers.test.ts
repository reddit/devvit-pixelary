import { describe, it, expect } from 'vitest';
import { abbreviateNumber } from './numbers';

describe('numbers utilities', () => {
  describe('abbreviateNumber', () => {
    it('returns original number for values less than 1000', () => {
      expect(abbreviateNumber(0)).toBe('0');
      expect(abbreviateNumber(1)).toBe('1');
      expect(abbreviateNumber(100)).toBe('100');
      expect(abbreviateNumber(999)).toBe('999');
    });

    it('abbreviates thousands with k suffix', () => {
      expect(abbreviateNumber(1000)).toBe('1k');
      expect(abbreviateNumber(1500)).toBe('1.5k');
      expect(abbreviateNumber(1999)).toBe('1.9k');
      expect(abbreviateNumber(2000)).toBe('2k');
      expect(abbreviateNumber(5000)).toBe('5k');
      expect(abbreviateNumber(999999)).toBe('999.9k');
    });

    it('abbreviates millions with M suffix', () => {
      expect(abbreviateNumber(1000000)).toBe('1M');
      expect(abbreviateNumber(1500000)).toBe('1.5M');
      expect(abbreviateNumber(1999999)).toBe('1.9M');
      expect(abbreviateNumber(2000000)).toBe('2M');
      expect(abbreviateNumber(5000000)).toBe('5M');
      expect(abbreviateNumber(999999999)).toBe('999.9M');
    });

    it('abbreviates billions with B suffix', () => {
      expect(abbreviateNumber(1000000000)).toBe('1B');
      expect(abbreviateNumber(1500000000)).toBe('1.5B');
      expect(abbreviateNumber(2000000000)).toBe('2B');
      expect(abbreviateNumber(5000000000)).toBe('5B');
      expect(abbreviateNumber(999999999999)).toBe('999.9B');
    });

    it('handles edge cases', () => {
      expect(abbreviateNumber(0)).toBe('0');
      expect(abbreviateNumber(-100)).toBe('-100');
      expect(abbreviateNumber(-1000)).toBe('-1000');
      expect(abbreviateNumber(-1000000)).toBe('-1000000');
    });

    it('handles decimal numbers with precision', () => {
      expect(abbreviateNumber(1000.5)).toBe('1k');
      expect(abbreviateNumber(1000.9)).toBe('1k');
      expect(abbreviateNumber(1999.9)).toBe('1.9k');
      expect(abbreviateNumber(1000000.5)).toBe('1M');
      expect(abbreviateNumber(1000000000.5)).toBe('1B');
      expect(abbreviateNumber(1000000000000.5)).toBe('1T');
    });

    it('abbreviates trillions with T suffix', () => {
      expect(abbreviateNumber(1000000000000)).toBe('1T');
      expect(abbreviateNumber(1500000000000)).toBe('1.5T');
      expect(abbreviateNumber(2000000000000)).toBe('2T');
      expect(abbreviateNumber(5000000000000)).toBe('5T');
      expect(abbreviateNumber(999999999999999)).toBe('999.9T');
    });

    it('handles very large numbers', () => {
      expect(abbreviateNumber(1000000000000000)).toBe('1000T');
      expect(abbreviateNumber(10000000000000000)).toBe('10000T');
    });

    it('handles boundary values', () => {
      expect(abbreviateNumber(999)).toBe('999');
      expect(abbreviateNumber(1000)).toBe('1k');
      expect(abbreviateNumber(999999)).toBe('999.9k');
      expect(abbreviateNumber(1000000)).toBe('1M');
      expect(abbreviateNumber(999999999)).toBe('999.9M');
      expect(abbreviateNumber(1000000000)).toBe('1B');
    });
  });
});
