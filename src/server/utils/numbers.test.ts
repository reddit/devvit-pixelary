import { describe, it, expect } from 'vitest';
import { isFiniteNumber, safeParseFloat, safeParseInt } from './numbers';

describe('numbers utilities', () => {
  describe('safeParseInt', () => {
    it('returns defaultValue for undefined', () => {
      expect(safeParseInt(undefined)).toBe(0);
      expect(safeParseInt(undefined, 42)).toBe(42);
    });

    it('returns defaultValue for empty string', () => {
      expect(safeParseInt('')).toBe(0);
      expect(safeParseInt('', 10)).toBe(10);
    });

    it('parses valid integers', () => {
      expect(safeParseInt('123')).toBe(123);
      expect(safeParseInt('0')).toBe(0);
      expect(safeParseInt('-5')).toBe(0); // Ensures non-negative
      expect(safeParseInt('999')).toBe(999);
    });

    it('returns defaultValue for invalid strings', () => {
      expect(safeParseInt('abc')).toBe(0);
      expect(safeParseInt('NaN')).toBe(0);
      expect(safeParseInt('12.34')).toBe(12); // parseInt truncates
      expect(safeParseInt('invalid', 42)).toBe(42);
    });

    it('ensures non-negative values', () => {
      expect(safeParseInt('-1')).toBe(0);
      expect(safeParseInt('-100')).toBe(0);
      expect(safeParseInt('0')).toBe(0);
      expect(safeParseInt('1')).toBe(1);
    });

    it('handles Infinity and -Infinity', () => {
      expect(safeParseInt('Infinity')).toBe(0);
      expect(safeParseInt('-Infinity')).toBe(0);
    });
  });

  describe('safeParseFloat', () => {
    it('returns defaultValue for undefined', () => {
      expect(safeParseFloat(undefined, 0.5)).toBe(0.5);
      expect(safeParseFloat(undefined, 42)).toBe(42);
    });

    it('returns defaultValue for empty string', () => {
      expect(safeParseFloat('', 0.5)).toBe(0.5);
      expect(safeParseFloat('', 10)).toBe(10);
    });

    it('parses valid floats', () => {
      expect(safeParseFloat('123.45', 0)).toBe(123.45);
      expect(safeParseFloat('0', 0)).toBe(0);
      expect(safeParseFloat('-5.5', 0)).toBe(-5.5);
      expect(safeParseFloat('999.999', 0)).toBe(999.999);
    });

    it('returns defaultValue for invalid strings', () => {
      expect(safeParseFloat('abc', 0.5)).toBe(0.5);
      expect(safeParseFloat('NaN', 0.5)).toBe(0.5);
      expect(safeParseFloat('invalid', 42)).toBe(42);
    });

    it('clamps to min when provided', () => {
      expect(safeParseFloat('5', 0, 10)).toBe(10); // 5 < 10, so clamp to 10
      expect(safeParseFloat('15', 0, 10)).toBe(15); // 15 >= 10, so keep 15
      expect(safeParseFloat('-5', 0, 0)).toBe(0); // -5 < 0, so clamp to 0
    });

    it('clamps to max when provided', () => {
      expect(safeParseFloat('15', 0, undefined, 10)).toBe(10); // 15 > 10, so clamp to 10
      expect(safeParseFloat('5', 0, undefined, 10)).toBe(5); // 5 <= 10, so keep 5
      expect(safeParseFloat('100', 0, undefined, 50)).toBe(50); // 100 > 50, so clamp to 50
    });

    it('clamps to both min and max when provided', () => {
      expect(safeParseFloat('5', 0, 10, 20)).toBe(10); // 5 < 10, so clamp to 10
      expect(safeParseFloat('15', 0, 10, 20)).toBe(15); // 10 <= 15 <= 20, so keep 15
      expect(safeParseFloat('25', 0, 10, 20)).toBe(20); // 25 > 20, so clamp to 20
      expect(safeParseFloat('-5', 0, 10, 20)).toBe(10); // -5 < 10, so clamp to 10
    });

    it('handles Infinity and -Infinity', () => {
      expect(safeParseFloat('Infinity', 0.5)).toBe(0.5);
      expect(safeParseFloat('-Infinity', 0.5)).toBe(0.5);
    });

    it('handles edge cases with clamping', () => {
      expect(safeParseFloat('0', 0, 0, 1)).toBe(0);
      expect(safeParseFloat('1', 0, 0, 1)).toBe(1);
      expect(safeParseFloat('0.5', 0, 0, 1)).toBe(0.5);
    });
  });

  describe('isFiniteNumber', () => {
    it('returns true for finite numbers', () => {
      expect(isFiniteNumber(0)).toBe(true);
      expect(isFiniteNumber(1)).toBe(true);
      expect(isFiniteNumber(-1)).toBe(true);
      expect(isFiniteNumber(123.456)).toBe(true);
      expect(isFiniteNumber(-123.456)).toBe(true);
      expect(isFiniteNumber(Number.MAX_VALUE)).toBe(true);
      expect(isFiniteNumber(Number.MIN_VALUE)).toBe(true);
    });

    it('returns false for NaN', () => {
      expect(isFiniteNumber(NaN)).toBe(false);
      expect(isFiniteNumber(Number.NaN)).toBe(false);
    });

    it('returns false for Infinity', () => {
      expect(isFiniteNumber(Infinity)).toBe(false);
      expect(isFiniteNumber(-Infinity)).toBe(false);
      expect(isFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false);
      expect(isFiniteNumber(Number.NEGATIVE_INFINITY)).toBe(false);
    });

    it('handles edge cases', () => {
      expect(isFiniteNumber(0 / 1)).toBe(true);
      expect(isFiniteNumber(1 / 0)).toBe(false); // Infinity
      expect(isFiniteNumber(-1 / 0)).toBe(false); // -Infinity
      expect(isFiniteNumber(0 / 0)).toBe(false); // NaN
    });
  });
});
