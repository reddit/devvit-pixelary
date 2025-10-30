import type { CommandContext, CommandResult } from '../comment-commands';
import { getWords } from '@server/services/words/dictionary';

export async function handleWords(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  try {
    const pageSize = 200;
    const page = parseInt(args[0] || '1', 10) || 1;

    if (page < 1 || page > 1000) {
      return { success: false, error: 'Invalid page number (1-1000)' };
    }

    const offset = (page - 1) * pageSize;
    const result = await getWords(context.subredditName, offset, pageSize);

    const { words, total, hasMore } = result;
    const wordCount = total;
    const totalPages = Math.ceil(wordCount / pageSize);

    if (wordCount <= pageSize) {
      const wordList = words.join(', ');
      const response =
        `r/${context.subredditName} dictionary: ${wordList}\n\n` +
        `${wordCount} total words.\n\n`;

      return {
        success: true,
        response,
        metadata: { wordCount, totalPages: 1 },
      };
    }

    const wordList = words.join(', ');
    const nextPageText = hasMore
      ? ` Use \`!words ${page + 1}\` for next page.`
      : '';

    const response =
      `r/${context.subredditName} dictionary: ${wordList}\n\n` +
      `${wordCount} total words.\n\n` +
      `Page ${page} of ${totalPages}.${nextPageText}\n\n`;

    return {
      success: true,
      response,
      metadata: { page, totalPages, wordCount },
    };
  } catch (error) {
    return { success: false, error: 'Failed to retrieve dictionary.' };
  }
}
