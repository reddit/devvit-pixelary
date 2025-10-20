import type { CommandContext, CommandResult } from '../comment-commands';
import { getAllWords } from '../dictionary';

export async function handleWords(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  try {
    const words = await getAllWords();
    const wordCount = words.length;
    const pageSize = 200;

    // If 200 words or less, show all words without pagination
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

    // For more than 200 words, use pagination
    const page = parseInt(args[0] || '1', 10) || 1;
    if (page < 1 || page > 1000) {
      return {
        success: false,
        error: 'Invalid page number (1-1000)',
      };
    }

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageWords = words.slice(startIndex, endIndex);

    const totalPages = Math.ceil(wordCount / pageSize);
    const wordList = pageWords.join(', ');

    const response =
      `r/${context.subredditName} dictionary: ${wordList}\n\n` +
      `${wordCount} total words.\n\n` +
      `Page ${page} of ${totalPages}. Use \`!words ${page + 1}\` for next page.\n\n`;

    return {
      success: true,
      response,
      metadata: { page, totalPages, wordCount },
    };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to retrieve dictionary.',
    };
  }
}
