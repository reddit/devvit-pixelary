import type { CommandContext, CommandResult } from '../comment-commands';
import { addWord, getBannedWords } from '../dictionary';
import { getScore, getLevelByScore } from '../progression';
import { hasReward } from '../../../shared/rewards';

export async function handleAdd(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  try {
    // Check user level - requires Level 3 (1000+ points)
    if (context.authorId) {
      const userScore = await getScore(context.authorId);
      const userLevel = getLevelByScore(userScore);

      if (!hasReward(userLevel.rank, 'add_remove_words')) {
        return {
          success: false,
          error: 'Requires Level 3 to add words.',
        };
      }
    }

    if (args.length === 0) {
      return {
        success: false,
        error: 'Provide a word. Usage: `!add <word>`',
      };
    }

    const word = args[0]?.trim();
    if (!word || word.length > 50) {
      return {
        success: false,
        error: 'Invalid word. Max 50 characters.',
      };
    }

    // Check if word is banned before attempting to add
    const bannedWordsResult = await getBannedWords(0, 10000);
    const isBanned = bannedWordsResult.words.some(
      (w) => w.toLowerCase() === word.toLowerCase()
    );
    if (isBanned) {
      return {
        success: false,
        error: 'Word banned.',
      };
    }

    const success = await addWord(word);

    if (success) {
      return {
        success: true,
        response: `Added "${word}". Removed if comment deleted.`,
        metadata: { word, addedBy: context.authorName },
      };
    } else {
      return {
        success: false,
        error: `Already exists.`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to add word.',
    };
  }
}
