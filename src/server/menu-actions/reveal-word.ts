import type { Request, Response } from 'express';
import { getDrawing } from '../services/drawing';

/**
 * Menu action handler for revealing word
 * Shows the word for a drawing post
 */
export async function handleRevealWord(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { postId } = req.body;

    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'Post ID is required',
      });
      return;
    }

    const drawing = await getDrawing(postId);

    if (!drawing) {
      res.status(404).json({
        status: 'error',
        message: 'Drawing post not found',
      });
      return;
    }

    res.json({
      showToast: drawing.word,
    });
  } catch (error) {
    console.error(`Error revealing word: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to reveal word',
    });
  }
}
