import type { CommandContext, CommandResult } from '../comment-commands';
import { removeWord } from '@server/services/words/dictionary';
import { getScore, getLevelByScore } from '@server/services/progression';
import { hasReward } from '@shared/rewards';
import { normalizeCommandWord } from '@shared/utils/string';

export async function handleRemove(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  try {
    const userScore = await getScore(context.authorId);
    const userLevel = getLevelByScore(userScore);

    if (!hasReward(userLevel.rank, 'add_remove_words')) {
      return { success: false, error: 'Requires Level 2 to remove words.' };
    }

    if (args.length === 0) {
      return {
        success: false,
        error: 'Provide a word. Usage: `!remove <word>`',
      };
    }

    // Join all args to support multi-word inputs (e.g., "lava lamp")
    const input = args.join(' ');
    const normalized = normalizeCommandWord(input);

    if ('error' in normalized) {
      return { success: false, error: normalized.error };
    }

    const word = normalized.word;

    const success = await removeWord(word);

    if (success) {
      return {
        success: true,
        response: `Removed "${word}".`,
        metadata: { word, removedBy: context.authorName },
      };
    } else {
      return { success: false, error: `Not in dictionary.` };
    }
  } catch (error) {
    return { success: false, error: 'Failed to remove word.' };
  }
}
