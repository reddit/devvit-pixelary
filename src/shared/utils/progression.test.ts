import { describe, it, expect } from 'vitest';
import { getLevelByScore, generateLevel } from './progression';

describe('progression utilities', () => {
  describe('generateLevel', () => {
    it('generates correct levels for ranks 1-10', () => {
      expect(generateLevel(1)).toEqual({
        rank: 1,
        name: 'Newcomer',
        min: 0,
        max: 99,
        extraTime: 0,
      });

      expect(generateLevel(2)).toEqual({
        rank: 2,
        name: 'Apprentice',
        min: 100,
        max: 999,
        extraTime: 15,
      });

      expect(generateLevel(10)).toEqual({
        rank: 10,
        name: 'Grandmaster',
        min: 10000000000,
        max: 99999999999,
        extraTime: 135,
      });
    });

    it('generates bonus levels for ranks 11+', () => {
      expect(generateLevel(11)).toEqual({
        rank: 11,
        name: 'Bonus 1',
        min: 100000000000,
        max: 999999999999,
        extraTime: 150,
      });

      expect(generateLevel(12)).toEqual({
        rank: 12,
        name: 'Bonus 2',
        min: 1000000000000,
        max: 9999999999999,
        extraTime: 165,
      });
    });

    it('handles invalid ranks gracefully', () => {
      expect(generateLevel(0)).toEqual({
        rank: 1,
        name: 'Newcomer',
        min: 0,
        max: 99,
        extraTime: 0,
      });

      expect(generateLevel(-1)).toEqual({
        rank: 1,
        name: 'Newcomer',
        min: 0,
        max: 99,
        extraTime: 0,
      });
    });
  });

  describe('getLevelByScore', () => {
    it('returns correct level for new boundaries', () => {
      expect(getLevelByScore(0).rank).toBe(1);
      expect(getLevelByScore(50).rank).toBe(1);
      expect(getLevelByScore(99).rank).toBe(1);

      expect(getLevelByScore(100).rank).toBe(2);
      expect(getLevelByScore(500).rank).toBe(2);
      expect(getLevelByScore(999).rank).toBe(2);

      expect(getLevelByScore(1000).rank).toBe(3);
      expect(getLevelByScore(5000).rank).toBe(3);
      expect(getLevelByScore(9999).rank).toBe(3);
    });

    it('handles edge cases correctly', () => {
      expect(getLevelByScore(0).name).toBe('Newcomer');
      expect(getLevelByScore(1).name).toBe('Newcomer');
      expect(getLevelByScore(99).name).toBe('Newcomer');
      expect(getLevelByScore(100).name).toBe('Apprentice');
    });

    it('calculates extraTime correctly', () => {
      expect(getLevelByScore(0).extraTime).toBe(0);
      expect(getLevelByScore(100).extraTime).toBe(15);
      expect(getLevelByScore(1000).extraTime).toBe(30);
      expect(getLevelByScore(10000).extraTime).toBe(45);
    });

    it('handles very high scores with infinite levels', () => {
      const highScore = 100000000000; // Level 11
      const result = getLevelByScore(highScore);
      expect(result.rank).toBe(11);
      expect(result.name).toBe('Bonus 1');
      expect(result.extraTime).toBe(150);
    });

    it('handles negative scores', () => {
      const result = getLevelByScore(-1);
      expect(result.rank).toBe(1);
      expect(result.name).toBe('Newcomer');
    });

    it('handles undefined score', () => {
      const result = getLevelByScore();
      expect(result.rank).toBe(1);
      expect(result.name).toBe('Newcomer');
    });
  });
});
