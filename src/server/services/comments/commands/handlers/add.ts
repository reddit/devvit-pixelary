import type { CommandContext, CommandResult } from '../comment-commands';
import { addWord, getBannedWords } from '@server/services/words/dictionary';
import { getScore, getLevelByScore } from '@server/services/progression';
import { hasReward } from '@shared/rewards';
import { addBacker } from '@server/services/words/word-backing';

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

    const word = args[0]?.trim();
    if (!word || word.length > 50) {
      return { success: false, error: 'Invalid word. Max 50 characters.' };
    }

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
