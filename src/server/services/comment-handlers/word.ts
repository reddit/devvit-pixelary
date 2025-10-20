import type { CommandResult } from '../comment-commands';
import { getWords } from '../dictionary';

export async function handleWord(args: string[]): Promise<CommandResult> {
  try {
    if (args.length === 0) {
      return {
        success: true,
        response: 'Provide a word. Usage: `!word <word>`',
      };
    }

    const word = args[0]?.trim();
    if (!word) {
      return {
        success: false,
        error: 'Invalid word.',
      };
    }

    // First check if the word exists in the dictionary
    const words = await getWords();
    const wordExists = words.some(
      (w) => w.toLowerCase() === word.toLowerCase()
    );

    if (!wordExists) {
      return {
        success: false,
        error: `"${word}" is not in the dictionary. Use \`!words\` to see available words.`,
      };
    }

    const response = `Statistics for "${word}".`;

    return {
      success: true,
      response,
      metadata: { word, isBanned: false },
    };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to retrieve word statistics',
    };
  }
}
