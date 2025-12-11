import type { Request, Response } from 'express';
import { context, reddit } from '@devvit/web/server';
import { getBacker } from '@server/services/words/word-backing';
import { normalizeWord } from '@shared/utils/string';
import { isWordInList, isWordBanned } from '@server/services/words/dictionary';

/**
 * Form handler for finding word backer
 * Gets the backer comment for a word and navigates to it
 */

export async function handleFindWordBacker(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { word } = req.body;

    if (!word) {
      res.status(400).json({
        showToast: 'Word is required',
      });
      return;
    }

    const normalizedWord = normalizeWord(word);

    // Check if word is in dictionary and banned
    const [wordInList, wordBanned] = await Promise.all([
      isWordInList(normalizedWord),
      isWordBanned(normalizedWord),
    ]);

    const commentId = await getBacker(normalizedWord);

    if (!commentId) {
      let message: string;
      if (wordBanned) {
        message = 'Word is banned';
      } else if (wordInList) {
        message = 'No backer found';
      } else {
        message = 'Not in dictionary';
      }

      res.json({
        showToast: message,
      });
      return;
    }

    const comment = await reddit.getCommentById(commentId);
    const postId = comment.postId;
    const subredditName = context.subredditName;
    if (!subredditName) {
      console.error('[Find Word Backer] No subreddit name in context');
      res.status(400).json({
        showToast: 'Subreddit not found',
      });
      return;
    }

    // Navigate to the comment URL
    const url = `https://reddit.com/r/${subredditName}/comments/${postId}/_/${commentId}`;

    res.json({
      navigateTo: url,
    });
  } catch (error) {
    console.error('Error finding word backer:', error);
    res.status(500).json({
      showToast: 'Error finding word backer',
    });
  }
}
