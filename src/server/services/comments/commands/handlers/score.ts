import type { CommandContext, CommandResult } from '../comment-commands';
import { getScore, getRank, getUserLevel } from '@server/services/progression';
import { getUsername } from '@server/core/redis';
import { reddit } from '@devvit/web/server';
import type { T2 } from '@devvit/shared-types/tid.js';

export async function handleScore(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  try {
    let userId: T2;

    if (args.length === 0) {
      userId = context.authorId;
    } else {
      const usernameArg = args[0]?.trim();
      if (!usernameArg) {
        return { success: false, error: 'Invalid username' };
      }

      const cleanUsername = usernameArg.startsWith('u/')
        ? usernameArg.slice(2)
        : usernameArg;

      const user = await reddit.getUserByUsername(cleanUsername);
      if (!user) {
        return { success: false, error: `User u/${cleanUsername} not found` };
      }

      userId = user.id as T2;
    }

    const [score, rank, level, username] = await Promise.all([
      getScore(userId),
      getRank(userId),
      getUserLevel(await getScore(userId)),
      getUsername(userId),
    ]);

    const isSelf = userId === context.authorId;
    const rankText = rank === -1 ? 'Unranked' : `Rank ${rank}`;
    const response = isSelf
      ? `You have ${score} points (Level ${level.rank}, ${rankText})`
      : `u/${username} has ${score} points (Level ${level.rank}, ${rankText})`;

    return {
      success: true,
      response,
      metadata: {
        userId,
        score,
        rank: rank === -1 ? null : rank,
        level: level.rank,
        username,
        isSelf,
      },
    };
  } catch (error) {
    return { success: false, error: 'Failed to retrieve user score' };
  }
}
