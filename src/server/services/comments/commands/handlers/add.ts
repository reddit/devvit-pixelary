import type { CommandContext, CommandResult } from '../comment-commands';
import { addWord, getBannedWords } from '@server/services/words/dictionary';
import { getScore, getLevelByScore } from '@server/services/progression';
import { hasReward } from '@shared/rewards';
import { addBacker } from '@server/services/words/word-backing';
import { normalizeCommandWord } from '@shared/utils/string';

export async function handleAdd(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  try {
    const userScore = await getScore(context.authorId);
    const userLevel = getLevelByScore(userScore);

    if (!hasReward(userLevel.rank, 'add_remove_words')) {
      return { success: false, error: 'Requires Level 2 to add words.' };
    }

    if (args.length === 0) {
      return { success: false, error: 'Provide a word. Usage: `!add <word>`' };
    }

    // Join all args to support multi-word inputs (e.g., "lava lamp")
    const input = args.join(' ');
    const normalized = normalizeCommandWord(input);

    if ('error' in normalized) {
      return { success: false, error: normalized.error };
    }

    const word = normalized.word;

    const bannedWordsResult = await getBannedWords(0, 10000);
    const isBanned = bannedWordsResult.words.some(
      (w) => w.toLowerCase() === word.toLowerCase()
    );
    if (isBanned) {
      return { success: false, error: 'Word banned.' };
    }

    const success = await addWord(word);

    if (success) {
      await addBacker(word, context.commentId);
      return {
        success: true,
        response: `Added "${word}". Removed if comment deleted.`,
        metadata: { word, addedBy: context.authorName },
      };
    } else {
      return { success: false, error: `Already exists.` };
    }
  } catch (error) {
    return { success: false, error: 'Failed to add word.' };
  }
}
