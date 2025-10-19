import { binFind } from './array';
import { LEVELS } from '../constants';
import type { Level } from '../types';

/**
 * Get level by score using binary search
 */

export function getLevelByScore(score: number = 0) {
  const defaultLevel = LEVELS[0] as Level;
  const level = binFind<Level>(LEVELS, (level) => {
    if (score < level.min) return 1;
    if (score >= level.max) return -1;
    return 0;
  });
  return level ?? defaultLevel;
}
