import type { CommandContext, CommandResult } from '../comment-commands';
import { isAdmin, isModerator } from '@server/core/redis';
import { reddit } from '@devvit/web/server';
import type { T2 } from '@devvit/shared-types/tid.js';
import { CONSUMABLES_CONFIG, type ConsumableId } from '@shared/consumables';

export async function handleDispense(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  try {
    // Authorization: admin or mod only
    const userIsAdmin = await isAdmin(context.authorId);
    const userIsModerator = await isModerator(
      context.authorId,
      context.subredditName
    );
    if (!userIsAdmin && !userIsModerator) {
      return { success: false, error: 'Not authorized' };
    }

    // Expect: !dispense u/<username> <itemId> <qty>
    if (args.length < 3) {
      return {
        success: false,
        error: 'Usage: !dispense u/<username> <itemId> <qty>',
      };
    }

    const [uArg, itemArg, qtyArg] = args;
    const rawUsername = uArg.trim();
    const itemId = itemArg.trim() as ConsumableId;
    const qty = parseInt(qtyArg.trim(), 10);

    if (!rawUsername.startsWith('u/')) {
      return { success: false, error: 'Username must start with u/' };
    }
    if (!Object.prototype.hasOwnProperty.call(CONSUMABLES_CONFIG, itemId)) {
      return { success: false, error: 'Unknown itemId' };
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return { success: false, error: 'Quantity must be a positive integer' };
    }

    const username = rawUsername.slice(2);
    const user = await reddit.getUserByUsername(username);
    if (!user) {
      return { success: false, error: `User ${rawUsername} not found` };
    }

    const targetUserId = user.id;
    const { grantItems } = await import('../../../rewards/consumables');
    await grantItems(targetUserId, [{ itemId, quantity: qty }]);

    const itemCfg = CONSUMABLES_CONFIG[itemId];
    const label = itemCfg.label;
    const response = `Dispensed ${qty} × ${label} to ${rawUsername}.`;
    return { success: true, response };
  } catch {
    return { success: false, error: 'Failed to dispense items' };
  }
}
