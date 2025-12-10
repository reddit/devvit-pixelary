import type { CommandContext, CommandResult } from '../comment-commands';

export async function handleHelp(
  _args: string[],
  _context: CommandContext
): Promise<CommandResult> {
  const response = `I can respond to the following commands:
    
* \`!words <optional page number>\` - Show dictionary.  \`!words\` or \`!words 2\` to show specific page.
* \`!add <word>\` - Add word to dictionary. Type the word after the command (max 12 characters, letters/numbers/hyphens/spaces only). For example \`!add meatloaf\` or \`!add lava lamp\` (Level 2 required)
* \`!remove <word>\` - Remove word from dictionary. Type the word after the command (max 12 characters, letters/numbers/hyphens/spaces only). For example \`!remove meatloaf\` or \`!remove lava lamp\` (Level 2 required)
* \`!stats <word>\` - Show statistics for a word. For example \`!stats meatloaf\` or \`!stats lava lamp\`
* \`!show <word>\` - Reveal an obfuscated guess on the results screen. For example \`!show meatloaf\` or \`!show lava lamp\`
* \`!score <optional username>\` - Shows the score for a user. Or your own score if no username is provided. For example \`!score\` or \`!score oppdager\`
* \`!help\` - Show this list of commands.
    
Accountability note: Users can add new words via public comments. Others can remove them. Words removed by Reddit's safety systems cannot be added back.`;

  return { success: true, response };
}
