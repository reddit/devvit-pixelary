import type { Request, Response } from 'express';
import { context } from '@devvit/web/server';
import { createTournament } from '../services/tournament/post';

export async function handleTournamentPostSubmit(
  req: Request,
  res: Response
): Promise<void> {
  try {
    console.log('Tournament post submit request received:', {
      body: req.body,
      subredditName: context.subredditName,
    });

    // Get word from request body (may be empty string)
    const word = req.body.word || undefined;

    // Create tournament post with optional word
    const postId = await createTournament(word);

    console.log('Tournament post created successfully:', postId);

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
