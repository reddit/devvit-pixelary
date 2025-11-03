import type { CommandContext, CommandResult } from '../comment-commands';
import { normalizeWord } from '@shared/utils/string';
import { isWordBanned } from '@server/services/words/dictionary';
import {
  getBacker,
  addBacker,
  shouldShowWord,
} from '@server/services/words/word-backing';
import { incrementScore } from '@server/services/progression';

export async function handleShow(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  try {
    if (args.length === 0) {
      return { success: false, error: 'Provide a word. Usage: `!show <word>`' };
    }

    const word = args[0]?.trim();
    if (!word) {
      return { success: false, error: 'Invalid word.' };
    }

    const normalizedWord = normalizeWord(word);

    const banned = await isWordBanned(normalizedWord);
    if (banned) {
      return {
        success: true,
        response: 'This word is banned.',
        metadata: { word: normalizedWord, wasBacked: false, isBanned: true },
      };
    }

    const isAlreadyVisible = await shouldShowWord(normalizedWord);
    if (isAlreadyVisible) {
      return {
        success: true,
        response: 'This word is already visible.',
        metadata: { word: normalizedWord, wasBacked: false, isBanned: false },
      };
    }

    const existingBacking = await getBacker(normalizedWord);
    const isFirstTimeBacking = existingBacking === null;

    await addBacker(normalizedWord, context.commentId);

    if (isFirstTimeBacking) {
      try {
        await incrementScore(context.authorId, 1);
      } catch {
        // ignore scoring errors
      }
    }

    return {
      success: true,
      response: 'This word is now visible.',
      metadata: { word: normalizedWord, wasBacked: true, isBanned: false },
    };
  } catch (error) {
    return { success: false, error: 'Failed to back word.' };
  }
}
