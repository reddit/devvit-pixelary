import type { CommandResult } from '../comment-commands';
import { isWordInList } from '../dictionary';
import { getWordMetrics } from '../slate';

export async function handleStats(args: string[]): Promise<CommandResult> {
  try {
    if (args.length === 0) {
      return {
        success: true,
        response: 'Provide a word. Usage: `!stats <word>`',
      };
    }

    const word = args[0]?.trim();
    if (!word) {
      return {
        success: false,
        error: 'Invalid word.',
      };
    }

    // Check if the word exists in the dictionary
    const wordExists = await isWordInList(word);
    if (!wordExists) {
      return {
        success: false,
        error: `Word not found. See \`!words\`.`,
      };
    }

    // Get word metrics
    const metrics = await getWordMetrics(word);

    console.log('Got metrics for:', word, metrics);

    // Format metrics concisely
    const response = `##### 🎨 Drawer stats
- Shown: ${metrics.slateImpressions}
- Picked: ${metrics.slatePicks} (${(metrics.slatePickRate * 100).toFixed(1)}%)
- Started: ${metrics.drawingStarts}
- First pixel: ${metrics.drawingFirstPixel}
- Published: ${metrics.drawingPublishes} (${(metrics.drawingPublishRate * 100).toFixed(1)}%)
- Manual completion: ${metrics.drawingDoneManual}
- Auto completion: ${metrics.drawingDoneAuto}
- Cancelled: ${metrics.drawingCancels}

##### 📈 Social stats
- Upvotes: ${metrics.postUpvotes}
- Comments: ${metrics.postComments}`;

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
