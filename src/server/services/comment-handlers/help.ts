import type { CommandContext, CommandResult } from '../comment-commands';

export async function handleHelp(
  _args: string[],
  _context: CommandContext
): Promise<CommandResult> {
  const response =
    `I can respond to the following commands:\n\n` +
    `• \`!words <optional page number>\` - Show dictionary\n` +
    `  \`!words\` or \`!words 2\` - Show page 1 or specific page\n\n` +
    `• \`!add <word>\` - Add word to dictionary\n` +
    `  \`!add dog\` - Add "dog" to dictionary\n\n` +
    `• \`!remove <word>\` - Remove word from dictionary\n` +
    `  \`!remove cat\` - Remove "cat" from dictionary\n\n` +
    `• \`!stats <word>\` - Show word statistics\n` +
    `  \`!stats meatloaf\` - Show statistics for "meatloaf"\n\n` +
    `• \`!show <word>\` - Show guess statistics for a word\n` +
    `  \`!show meatloaf\` - Shows stats for "meatloaf" on this post\n\n` +
    `• \`!score <optional username>\` - Show user score\n` +
    `  \`!score\` or \`!score username\` - Show your score or another user's\n\n` +
    `• \`!help\` - Show this help\n\n` +
    `Accountability note:\n` +
    `Users add words publicly via comments. Others can remove them. Words removed by Reddit's safety systems cannot be added back.`;

  return {
    success: true,
    response,
  };
}
