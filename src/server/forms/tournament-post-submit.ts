import type { Request, Response } from 'express';
import { context } from '@devvit/web/server';
import { createTournament } from '../services/tournament-post';

export async function handleTournamentPostSubmit(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Create tournament post
    const postId = await createTournament();

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
