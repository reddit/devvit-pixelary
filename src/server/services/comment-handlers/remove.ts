import type { CommandContext, CommandResult } from '../comment-commands';
import { removeWord } from '../dictionary';

export async function handleRemove(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  try {
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

    const success = await removeWord(word, context.subredditName);

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
