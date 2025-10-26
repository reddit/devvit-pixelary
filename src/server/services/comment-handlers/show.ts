import type { CommandContext, CommandResult } from '../comment-commands';
import { normalizeWord } from '../../../shared/utils/string';
import { isWordBanned } from '../dictionary';
import { getBacker, addBacker, shouldShowWord } from '../word-backing';
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

    const normalizedWord = normalizeWord(word);

    // Check if banned
    const isBanned = await isWordBanned(normalizedWord);
    if (isBanned) {
      return {
        success: true,
        response: 'This word is banned.',
        metadata: {
          word: normalizedWord,
          wasBacked: false,
          isBanned: true,
        },
      };
    }

    // Check if already visible (backed or in dictionary)
    const isAlreadyVisible = await shouldShowWord(normalizedWord);
    if (isAlreadyVisible) {
      return {
        success: true,
        response: 'This word is already visible.',
        metadata: {
          word: normalizedWord,
          wasBacked: false,
          isBanned: false,
        },
      };
    }

    // Check if backing already exists before adding
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

    return {
      success: true,
      response: 'This word is now visible.',
      metadata: {
        word: normalizedWord,
        wasBacked: true,
        isBanned: false,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to back word.',
    };
  }
}
