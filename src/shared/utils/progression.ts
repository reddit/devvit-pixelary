import { LEVELS, EXTRA_TIME_PER_LEVEL } from '../constants';
import type { Level } from '../types';

/**
 * Generate level data for any rank (supports infinite levels)
 * @param rank - The level rank (1-based)
 * @returns Level data with name, min/max points, and extraTime
 */
export function generateLevel(rank: number): Level {
  // Handle named levels (1-10)
  if (rank >= 1 && rank <= LEVELS.length) {
    const namedLevel = LEVELS[rank - 1]!;
    return {
      ...namedLevel,
      extraTime: (rank - 1) * EXTRA_TIME_PER_LEVEL,
    };
  }

  // Handle bonus levels (11+)
  if (rank > LEVELS.length) {
    const bonusNumber = rank - LEVELS.length;
    const min = Math.pow(10, rank);
    const max = Math.pow(10, rank + 1) - 1;

    return {
      rank,
      name: `Bonus ${bonusNumber}`,
      min,
      max,
      extraTime: (rank - 1) * EXTRA_TIME_PER_LEVEL,
    };
  }

  // Fallback to level 1 for invalid ranks
  return {
    ...LEVELS[0]!,
    extraTime: 0,
  };
}

/**
 * Get level by score using mathematical calculation (supports infinite levels)
 * @param score - The user's score
 * @returns The level data for the given score
 */
export function getLevelByScore(score: number = 0): Level {
  // Handle edge case: score 0-99 should be level 1
  if (score < 100) {
    return generateLevel(1);
  }

  // Calculate rank using log10: rank = floor(log10(score)) + 1
  // 100-999 → log10(100) = 2, so rank = 2 + 1 = 3... wait that's wrong
  // Let me recalculate: 100-999 → level 2, 1000-9999 → level 3
  // So: rank = floor(log10(score)) - 1 + 1 = floor(log10(score))
  const rank = Math.floor(Math.log10(score));

  return generateLevel(rank);
}
