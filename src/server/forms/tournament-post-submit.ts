import type { Request, Response } from 'express';
import { context } from '@devvit/web/server';
import {
  getTournamentWord,
  createTournamentPost,
} from '../services/tournament-post';

export async function handleTournamentPostSubmit(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { date, word } = req.body;

    if (!date) {
      res.status(400).json({
        status: 'error',
        message: 'Date is required',
      });
      return;
    }

    // Get or generate word
    const tournamentWord = word || (await getTournamentWord(date));

    // Create tournament post
    const postId = await createTournamentPost(tournamentWord, date);

    const postUrl = `https://reddit.com/r/${context.subredditName}/comments/${postId}`;

    res.json({
      navigateTo: postUrl,
    });
  } catch (error) {
    console.error(`Error creating tournament post: ${error}`);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create tournament post',
    });
  }
}
