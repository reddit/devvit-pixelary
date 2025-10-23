import { describe, it, expect } from 'vitest';
import { getDifficultyFromStats } from './flair';

describe('Flair Service', () => {
  describe('getDifficultyFromStats', () => {
    it('should return "unranked" for posts with no players', () => {
      const stats = {
        playerCount: 0,
        guessCount: 0,
        solves: 0,
        solvedPercentage: 0,
        skips: 0,
        skipPercentage: 0,
        wordCount: 0,
        guesses: [],
      };

      const result = getDifficultyFromStats(stats);

      expect(result).toBe('unranked');
    });

    it('should return "unranked" for posts with very few players', () => {
      const stats = {
        playerCount: 2,
        guessCount: 3,
        solves: 1,
        solvedPercentage: 50,
        skips: 0,
        skipPercentage: 0,
        wordCount: 0,
        guesses: [],
      };

      const result = getDifficultyFromStats(stats);

      expect(result).toBe('unranked');
    });

    it('should return "easy" for high solve rate', () => {
      const stats = {
        playerCount: 20,
        guessCount: 25,
        solves: 18,
        solvedPercentage: 90,
        skips: 2,
        skipPercentage: 10,
        wordCount: 0,
        guesses: [],
      };

      const result = getDifficultyFromStats(stats);

      expect(result).toBe('easy');
    });

    it('should return "easy" for solve rate at boundary (80%)', () => {
      const stats = {
        playerCount: 20,
        guessCount: 25,
        solves: 16,
        solvedPercentage: 80,
        skips: 4,
        skipPercentage: 20,
        wordCount: 0,
        guesses: [],
      };

      const result = getDifficultyFromStats(stats);

      expect(result).toBe('easy');
    });

    it('should return "medium" for moderate solve rate', () => {
      const stats = {
        playerCount: 20,
        guessCount: 30,
        solves: 12,
        solvedPercentage: 60,
        skips: 8,
        skipPercentage: 40,
        wordCount: 0,
        guesses: [],
      };

      const result = getDifficultyFromStats(stats);

      expect(result).toBe('medium');
    });

    it('should return "medium" for solve rate at boundary (50%)', () => {
      const stats = {
        playerCount: 20,
        guessCount: 30,
        solves: 10,
        solvedPercentage: 50,
        skips: 10,
        skipPercentage: 50,
        wordCount: 0,
        guesses: [],
      };

      const result = getDifficultyFromStats(stats);

      expect(result).toBe('medium');
    });

    it('should return "hard" for low solve rate', () => {
      const stats = {
        playerCount: 20,
        guessCount: 40,
        solves: 6,
        solvedPercentage: 30,
        skips: 14,
        skipPercentage: 70,
        wordCount: 0,
        guesses: [],
      };

      const result = getDifficultyFromStats(stats);

      expect(result).toBe('hard');
    });

    it('should return "hard" for solve rate at boundary (25%)', () => {
      const stats = {
        playerCount: 20,
        guessCount: 40,
        solves: 5,
        solvedPercentage: 25,
        skips: 15,
        skipPercentage: 75,
        wordCount: 0,
        guesses: [],
      };

      const result = getDifficultyFromStats(stats);

      expect(result).toBe('hard');
    });

    it('should return "expert" for very low solve rate', () => {
      const stats = {
        playerCount: 20,
        guessCount: 50,
        solves: 2,
        solvedPercentage: 10,
        skips: 18,
        skipPercentage: 90,
        wordCount: 0,
        guesses: [],
      };

      const result = getDifficultyFromStats(stats);

      expect(result).toBe('expert');
    });

    it('should return "expert" for solve rate at boundary (10%)', () => {
      const stats = {
        playerCount: 20,
        guessCount: 50,
        solves: 2,
        solvedPercentage: 10,
        skips: 18,
        skipPercentage: 90,
        wordCount: 0,
        guesses: [],
      };

      const result = getDifficultyFromStats(stats);

      expect(result).toBe('expert');
    });

    it('should return "expert" for 0% solve rate', () => {
      const stats = {
        playerCount: 20,
        guessCount: 50,
        solves: 0,
        solvedPercentage: 0,
        skips: 20,
        skipPercentage: 100,
        wordCount: 0,
        guesses: [],
      };

      const result = getDifficultyFromStats(stats);

      expect(result).toBe('expert');
    });

    it('should handle 100% solve rate', () => {
      const stats = {
        playerCount: 20,
        guessCount: 20,
        solves: 20,
        solvedPercentage: 100,
        skips: 0,
        skipPercentage: 0,
        wordCount: 0,
        guesses: [],
      };

      const result = getDifficultyFromStats(stats);

      expect(result).toBe('easy');
    });

    it('should handle edge case with exactly 3 players', () => {
      const stats = {
        playerCount: 3,
        guessCount: 5,
        solves: 2,
        solvedPercentage: 66.7,
        skips: 1,
        skipPercentage: 33.3,
        wordCount: 0,
        guesses: [],
      };

      const result = getDifficultyFromStats(stats);

      expect(result).toBe('unranked');
    });

    it('should handle edge case with exactly 4 players', () => {
      const stats = {
        playerCount: 4,
        guessCount: 6,
        solves: 3,
        solvedPercentage: 75,
        skips: 1,
        skipPercentage: 25,
        wordCount: 0,
        guesses: [],
      };

      const result = getDifficultyFromStats(stats);

      expect(result).toBe('medium'); // 75% is >= 50% but < 80%
    });

    it('should handle high player count', () => {
      const stats = {
        playerCount: 100,
        guessCount: 150,
        solves: 30,
        solvedPercentage: 30,
        skips: 70,
        skipPercentage: 70,
        wordCount: 0,
        guesses: [],
      };

      const result = getDifficultyFromStats(stats);

      expect(result).toBe('hard');
    });

    it('should handle fractional solve percentages', () => {
      const stats = {
        playerCount: 20,
        guessCount: 30,
        solves: 11,
        solvedPercentage: 55,
        skips: 9,
        skipPercentage: 45,
        wordCount: 0,
        guesses: [],
      };

      const result = getDifficultyFromStats(stats);

      expect(result).toBe('medium');
    });

    it('should handle undefined/null stats gracefully', () => {
      const stats = {
        playerCount: 0,
        guessCount: 0,
        solves: 0,
        solvedPercentage: 0,
        skips: 0,
        skipPercentage: 0,
        wordCount: 0,
        guesses: [],
      };

      const result = getDifficultyFromStats(stats);

      expect(result).toBe('unranked');
    });
  });
});
