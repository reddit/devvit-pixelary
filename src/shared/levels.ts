import { binFind } from './utils/math';

// Level data structure (simplified - would need full levels.json)
export type Level = {
  rank: number;
  name: string;
  min: number;
  max: number;
  extraTime: number;
};

// Mock levels data - in real implementation, this would come from levels.json
export const LEVELS: Level[] = [
  { rank: 1, name: 'Newcomer', min: 0, max: 100, extraTime: 0 },
  { rank: 2, name: 'Artist', min: 100, max: 300, extraTime: 3 },
  { rank: 3, name: 'Creator', min: 300, max: 700, extraTime: 6 },
  { rank: 4, name: 'Master', min: 700, max: 1500, extraTime: 9 },
  { rank: 5, name: 'Legend', min: 1500, max: 3100, extraTime: 12 },
];

/**
 * Get level by score using binary search
 */
export const getLevelByScore = (score: number = 0): Level =>
  binFind(LEVELS, (level) => {
    if (score < level.min) return 1;
    if (score >= level.max) return -1;
    return 0;
  }) ?? LEVELS[0]!;

/**
 * Get level by rank
 */
export function getLevel(rank: number): Level {
  return LEVELS[rank - 1] ?? LEVELS[0]!;
}
