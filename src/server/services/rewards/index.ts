import type { T2 } from '@devvit/shared-types/tid.js';
import { getScore, getUserLevel } from '@server/services/progression';
import { getExtraDrawingTime } from '@shared/rewards';
import { getActivityDrawingTimeBonus } from './activity';
import {
  getActiveExtraDrawingTimeSeconds,
  getEffectiveScoreMultiplier,
} from './consumables';

export type EffectiveBonuses = {
  extraDrawingTimeSeconds: number;
  scoreMultiplier: number;
  breakdown: {
    levelExtra: number;
    activityExtra: number;
    consumableExtra: number;
  };
};

export async function getEffectiveBonuses(
  userId: T2
): Promise<EffectiveBonuses> {
  const [score, activity, consumableExtra, scoreMultiplier] = await Promise.all(
    [
      getScore(userId),
      getActivityDrawingTimeBonus(userId),
      getActiveExtraDrawingTimeSeconds(userId),
      getEffectiveScoreMultiplier(userId),
    ]
  );

  const level = getUserLevel(score);
  const levelExtra = getExtraDrawingTime(level.rank);
  const activityExtra = activity?.extraDrawingTimeSeconds ?? 0;
  const consumableExtraSafe = Number.isFinite(consumableExtra as number)
    ? (consumableExtra as number)
    : 0;
  const extraDrawingTimeSeconds =
    levelExtra + activityExtra + consumableExtraSafe;

  return {
    extraDrawingTimeSeconds,
    scoreMultiplier,
    breakdown: {
      levelExtra,
      activityExtra,
      consumableExtra: consumableExtraSafe,
    },
  };
}
