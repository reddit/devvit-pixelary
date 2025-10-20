import { describe, it, expect } from 'vitest';
import { getLevelByScore } from './progression';
import { LEVELS } from '../constants';

describe('progression utilities', () => {
  describe('getLevelByScore', () => {
    it('returns first level for score 0', () => {
      const result = getLevelByScore(0);
      expect(result).toEqual(LEVELS[0]);
      expect(result.name).toBe('Newcomer');
      expect(result.rank).toBe(1);
    });

    it('returns first level for score 1', () => {
      const result = getLevelByScore(1);
      expect(result).toEqual(LEVELS[0]);
      expect(result.name).toBe('Newcomer');
    });

    it('returns second level for score 2', () => {
      const result = getLevelByScore(2);
      expect(result).toEqual(LEVELS[1]);
      expect(result.name).toBe('Apprentice');
      expect(result.rank).toBe(2);
    });

    it('returns second level for score 3', () => {
      const result = getLevelByScore(3);
      expect(result).toEqual(LEVELS[1]);
      expect(result.name).toBe('Apprentice');
    });

    it('returns third level for score 4', () => {
      const result = getLevelByScore(4);
      expect(result).toEqual(LEVELS[2]);
      expect(result.name).toBe('Artist');
      expect(result.rank).toBe(3);
    });

    it('returns correct level for middle scores', () => {
      const result = getLevelByScore(7);
      expect(result).toEqual(LEVELS[2]);
      expect(result.name).toBe('Artist');
    });

    it('returns highest level for very high scores', () => {
      const result = getLevelByScore(50000);
      expect(result).toEqual(LEVELS[LEVELS.length - 1]);
      expect(result.name).toBe('Pixelary Eternal');
      expect(result.rank).toBe(15);
    });

    it('returns correct level for boundary scores', () => {
      // Test min boundaries
      expect(getLevelByScore(0)).toEqual(LEVELS[0]);
      expect(getLevelByScore(2)).toEqual(LEVELS[1]);
      expect(getLevelByScore(4)).toEqual(LEVELS[2]);
      expect(getLevelByScore(8)).toEqual(LEVELS[3]);
      expect(getLevelByScore(16)).toEqual(LEVELS[4]);

      // Test max boundaries
      expect(getLevelByScore(1)).toEqual(LEVELS[0]);
      expect(getLevelByScore(3)).toEqual(LEVELS[1]);
      expect(getLevelByScore(7)).toEqual(LEVELS[2]);
      expect(getLevelByScore(15)).toEqual(LEVELS[3]);
      expect(getLevelByScore(31)).toEqual(LEVELS[4]);
    });

    it('handles undefined score by defaulting to 0', () => {
      const result = getLevelByScore();
      expect(result).toEqual(LEVELS[0]);
      expect(result.name).toBe('Newcomer');
    });

    it('handles negative scores', () => {
      const result = getLevelByScore(-1);
      expect(result).toEqual(LEVELS[0]);
      expect(result.name).toBe('Newcomer');
    });

    it('returns correct level for each rank', () => {
      // Test a few key levels
      expect(getLevelByScore(0).rank).toBe(1);
      expect(getLevelByScore(2).rank).toBe(2);
      expect(getLevelByScore(4).rank).toBe(3);
      expect(getLevelByScore(8).rank).toBe(4);
      expect(getLevelByScore(16).rank).toBe(5);
      expect(getLevelByScore(32).rank).toBe(6);
      expect(getLevelByScore(64).rank).toBe(7);
      expect(getLevelByScore(128).rank).toBe(8);
      expect(getLevelByScore(256).rank).toBe(9);
      expect(getLevelByScore(512).rank).toBe(10);
      expect(getLevelByScore(1024).rank).toBe(11);
      expect(getLevelByScore(2048).rank).toBe(12);
      expect(getLevelByScore(4096).rank).toBe(13);
      expect(getLevelByScore(8192).rank).toBe(14);
      expect(getLevelByScore(16384).rank).toBe(15);
    });

    it('returns correct extra time values', () => {
      expect(getLevelByScore(0).extraTime).toBe(0);
      expect(getLevelByScore(2).extraTime).toBe(3);
      expect(getLevelByScore(4).extraTime).toBe(6);
      expect(getLevelByScore(8).extraTime).toBe(9);
      expect(getLevelByScore(16).extraTime).toBe(12);
      expect(getLevelByScore(32).extraTime).toBe(15);
      expect(getLevelByScore(64).extraTime).toBe(18);
      expect(getLevelByScore(128).extraTime).toBe(21);
      expect(getLevelByScore(256).extraTime).toBe(24);
      expect(getLevelByScore(512).extraTime).toBe(27);
      expect(getLevelByScore(1024).extraTime).toBe(30);
      expect(getLevelByScore(2048).extraTime).toBe(33);
      expect(getLevelByScore(4096).extraTime).toBe(36);
      expect(getLevelByScore(8192).extraTime).toBe(39);
      expect(getLevelByScore(16384).extraTime).toBe(42);
    });

    it('handles decimal scores by flooring', () => {
      expect(getLevelByScore(1.9)).toEqual(LEVELS[0]);
      expect(getLevelByScore(2.1)).toEqual(LEVELS[1]);
      expect(getLevelByScore(3.9)).toEqual(LEVELS[1]);
      expect(getLevelByScore(4.1)).toEqual(LEVELS[2]);
    });

    it('works with binary search algorithm correctly', () => {
      // Test that the binary search finds the correct level
      const testCases = [
        { score: 0, expectedLevel: 0 },
        { score: 1, expectedLevel: 0 },
        { score: 2, expectedLevel: 1 },
        { score: 3, expectedLevel: 1 },
        { score: 4, expectedLevel: 2 },
        { score: 5, expectedLevel: 2 },
        { score: 6, expectedLevel: 2 },
        { score: 7, expectedLevel: 2 },
        { score: 8, expectedLevel: 3 },
        { score: 15, expectedLevel: 3 },
        { score: 16, expectedLevel: 4 },
        { score: 31, expectedLevel: 4 },
        { score: 32, expectedLevel: 5 },
        { score: 63, expectedLevel: 5 },
        { score: 64, expectedLevel: 6 },
        { score: 127, expectedLevel: 6 },
        { score: 128, expectedLevel: 7 },
        { score: 255, expectedLevel: 7 },
        { score: 256, expectedLevel: 8 },
        { score: 511, expectedLevel: 8 },
        { score: 512, expectedLevel: 9 },
        { score: 1023, expectedLevel: 9 },
        { score: 1024, expectedLevel: 10 },
        { score: 2047, expectedLevel: 10 },
        { score: 2048, expectedLevel: 11 },
        { score: 4095, expectedLevel: 11 },
        { score: 4096, expectedLevel: 12 },
        { score: 8191, expectedLevel: 12 },
        { score: 8192, expectedLevel: 13 },
        { score: 16383, expectedLevel: 13 },
        { score: 16384, expectedLevel: 14 },
        { score: 32767, expectedLevel: 14 },
        { score: 32768, expectedLevel: 14 }, // Beyond max, should return last level
      ];

      testCases.forEach(({ score, expectedLevel }) => {
        const result = getLevelByScore(score);
        expect(result).toEqual(LEVELS[expectedLevel]);
      });
    });
  });
});
