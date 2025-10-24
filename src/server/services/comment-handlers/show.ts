import type { CommandContext, CommandResult } from '../comment-commands';
import { redis } from '@devvit/web/server';
import { REDIS_KEYS } from '../redis';
import { titleCase } from '../../../shared/utils/string';
import { getWords } from '../dictionary';
import { getBacker, addBacker } from '../word-backing';
import { isWordBanned } from '../dictionary';
import { incrementScore } from '../progression';

export async function handleShow(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  try {
    if (args.length === 0) {
      return {
        success: false,
        error: 'Provide a word. Usage: `!show <word>`',
      };
    }

    const word = args[0]?.trim();
    if (!word) {
      return {
        success: false,
        error: 'Invalid word.',
      };
    }

    // Normalize the word using titleCase for consistent comparison
    const normalizedWord = titleCase(word);

    // Extract postId from context
    if (!context.postId) {
      return {
        success: false,
        error: 'Unable to determine post context.',
      };
    }

    // Get guess statistics for this word on this post
    const guessCount = await redis.zScore(
      REDIS_KEYS.drawingGuesses(context.postId),
      normalizedWord
    );
    const count = guessCount || 0;

    // Get total guesses to calculate percentage
    const allGuesses = await redis.zRange(
      REDIS_KEYS.drawingGuesses(context.postId),
      0,
      -1,
      { reverse: true, by: 'rank' }
    );
    const totalGuesses = allGuesses.reduce(
      (sum, guess) => sum + guess.score,
      0
    );
    const percentage =
      totalGuesses > 0 ? Math.round((count / totalGuesses) * 100) : 0;

    // Check if word is in dictionary
    const dictionaryResult = await getWords(context.subredditName, 0, 10000);
    const isInDictionary = dictionaryResult.words.some(
      (dictWord) => dictWord.toLowerCase() === normalizedWord.toLowerCase()
    );

    // Check if word is banned
    const isBanned = await isWordBanned(normalizedWord);

    // Check if word backing already exists before setting it
    const existingBacking = await getBacker(normalizedWord);
    const isFirstTimeBacking = existingBacking === null;

    // Store this comment as word backing comment for this word
    await addBacker(normalizedWord, context.commentId);

    // Award 1 point if this is the first time someone backs this word
    if (isFirstTimeBacking && context.authorId) {
      try {
        await incrementScore(context.authorId, 1);
      } catch (error) {
        // Silently ignore scoring errors - don't fail the command
      }
    }

    // Build response
    let response = `Guess made ${count} times (${percentage}%) so far.`;

    if (isInDictionary) {
      response += ` In dictionary.`;
    } else {
      if (isBanned) {
        response += ` Banned from dictionary.`;
      } else {
        response += ` Not in dictionary.`;
      }
    }

    return {
      success: true,
      response,
      metadata: {
        word: normalizedWord,
        count,
        percentage,
        isInDictionary,
        isBanned,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to retrieve word statistics.',
    };
  }
}
