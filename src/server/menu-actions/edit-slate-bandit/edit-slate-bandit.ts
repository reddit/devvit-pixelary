import type { Request, Response } from 'express';
import { setSlateBanditConfig } from '@server/services/words/slate';

/**
 * Form handler for slate bandit configuration update
 * Updates the slate bandit parameters in Redis
 */
export async function handleEditSlateBandit(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const {
      explorationRate,
      zScoreClamp,
      weightPickRate,
      weightPostRate,
      ucbConstant,
      scoreDecayRate,
    } = req.body;

    // Validate required fields
    if (
      explorationRate === undefined ||
      zScoreClamp === undefined ||
      weightPickRate === undefined ||
      weightPostRate === undefined ||
      ucbConstant === undefined ||
      scoreDecayRate === undefined
    ) {
      res.status(400).json({
        status: 'error',
        message: 'All fields are required',
      });
      return;
    }

    // Validate numeric values
    const explorationRateNum = parseFloat(explorationRate);
    const zScoreClampNum = parseFloat(zScoreClamp);
    const weightPickRateNum = parseFloat(weightPickRate);
    const weightPostRateNum = parseFloat(weightPostRate);
    const ucbConstantNum = parseFloat(ucbConstant);
    const scoreDecayRateNum = parseFloat(scoreDecayRate);
    if (
      isNaN(explorationRateNum) ||
      isNaN(zScoreClampNum) ||
      isNaN(weightPickRateNum) ||
      isNaN(weightPostRateNum) ||
      isNaN(ucbConstantNum) ||
      isNaN(scoreDecayRateNum)
    ) {
      res.status(400).json({
        status: 'error',
        message: 'All values must be valid numbers',
      });
      return;
    }

    // Validate ranges
    if (explorationRateNum < 0 || explorationRateNum > 1) {
      res.status(400).json({
        status: 'error',
        message: 'Exploration rate must be between 0 and 1',
      });
      return;
    }

    if (zScoreClampNum <= 0) {
      res.status(400).json({
        status: 'error',
        message: 'Z-score clamp must be positive',
      });
      return;
    }

    if (weightPickRateNum < 0 || weightPostRateNum < 0) {
      res.status(400).json({
        status: 'error',
        message: 'Weights must be non-negative',
      });
      return;
    }

    if (ucbConstantNum <= 0) {
      res.status(400).json({
        status: 'error',
        message: 'UCB constant must be positive',
      });
      return;
    }

    if (scoreDecayRateNum < 0 || scoreDecayRateNum > 1) {
      res.status(400).json({
        status: 'error',
        message: 'Score decay rate must be between 0 and 1',
      });
      return;
    }

    // Save configuration
    await setSlateBanditConfig({
      explorationRate: explorationRateNum,
      zScoreClamp: zScoreClampNum,
      weightPickRate: weightPickRateNum,
      weightPostRate: weightPostRateNum,
      ucbConstant: ucbConstantNum,
      scoreDecayRate: scoreDecayRateNum,
    });

    res.json({
      showToast: 'Updated!',
    });
  } catch (error) {
    console.error(`Error updating slate bandit config: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to update configuration',
    });
  }
}
