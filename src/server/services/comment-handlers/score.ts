import type { CommandContext, CommandResult } from '../comment-commands';

export async function handleScore(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  const targetUser =
    args.length > 0 ? args[0]?.trim() || '' : context.authorName;

  return {
    success: true,
    response: `Score tracking is not yet implemented. This would show u/${targetUser}'s points.`,
  };
}
