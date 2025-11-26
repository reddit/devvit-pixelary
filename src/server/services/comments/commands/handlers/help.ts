import type { CommandContext, CommandResult } from '../comment-commands';

export async function handleHelp(
  _args: string[],
  _context: CommandContext
): Promise<CommandResult> {
  const response = `I can respond to the following commands:
    
* \`!words <optional page number>\` - Show dictionary.  \`!words\` or \`!words 2\` to show specific page.
* \`!add <word>\` - Add word to dictionary (Level 2 required)
* \`!remove <word>\` - Remove word from dictionary (Level 2 required)
* \`!stats <word>\` - Show statistics for a word
* \`!show <word>\` - Reveal an obfuscated guess on the results screen
* \`!score <optional username>\` - Shows the score for a user. Or your own score if no username is provided.
* \`!help\` - Show this list of commands.
    
Accountability note: Users can add new words via public comments. Others can remove them. Words removed by Reddit's safety systems cannot be added back.`;

  return { success: true, response };
}
