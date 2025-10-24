import type { Request, Response } from 'express';
import { context } from '@devvit/web/server';
import { getDrawing } from '../services/drawing';

/**
 * Menu action handler for revealing the word for a drawing post
 */

export async function handleRevealWord(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const postId = context.postId;

    if (!postId) {
      res.status(400).json({
        showToast: 'Post ID is required',
      });
      return;
    }

    const drawing = await getDrawing(postId);

    if (!drawing) {
      res.json({
        showToast: 'Not a drawing post',
      });
      return;
    }

    res.json({
      showToast: drawing.word,
    });
  } catch (error) {
    console.error(`Error revealing word: ${error}`);
    res.status(500).json({
      showToast: 'Failed to reveal word',
    });
  }
}
