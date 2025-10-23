import type { CommandContext, CommandResult } from '../comment-commands';
import { removeWord } from '../dictionary';
import { getScore, getLevelByScore } from '../progression';

export async function handleRemove(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  try {
    // Check user level - requires Level 2 (100+ points)
    if (context.authorId) {
      const userScore = await getScore(context.authorId);
      const userLevel = getLevelByScore(userScore);

      if (userLevel.rank < 3) {
        return {
          success: false,
          error: 'Requires Level 3 to remove words.',
        };
      }
    }

    if (args.length === 0) {
      return {
        success: false,
        error: 'Provide a word. Usage: `!remove <word>`',
      };
    }

    const word = args[0]?.trim();
    if (!word) {
      return {
        success: false,
        error: 'Invalid word.',
      };
    }

    const success = await removeWord(word);

    if (success) {
      return {
        success: true,
        response: `Removed "${word}".`,
        metadata: { word, removedBy: context.authorName },
      };
    } else {
      return {
        success: false,
        error: `Not in dictionary.`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to remove word.',
    };
  }
}
