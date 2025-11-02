import type { Request, Response } from 'express';
import { context } from '@devvit/web/server';
import { createTournament } from '@server/services/posts/tournament/post';

export async function handleCreateTournamentPost(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const word = req.body.word || undefined;
    const postId = await createTournament(word);
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
