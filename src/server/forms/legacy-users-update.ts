import type { Request, Response } from 'express';
import { parseForm, z } from './_schema';
import { resolveUsernamesToIds } from '../core/user';
import { addLegacyUsers, removeLegacyUsers } from '../services/legacy';

export async function handleLegacyUsersUpdate(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { action, usernames } = parseForm(
      z.object({
        action: z.union([z.literal('add'), z.literal('remove')]),
        usernames: z.string().optional(),
      }),
      req.body
    );

    // Parse and deduplicate usernames
    const parsed = (usernames || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const deduped = Array.from(new Set(parsed));

    // Resolve usernames to userIds
    const userIds = await resolveUsernamesToIds(deduped);

    // Handle add action
    if (action === 'add') {
      const added = await addLegacyUsers(userIds);
      res.json({
        showToast: {
          text: `Added ${added} users`,
        },
      });
      return;
    }

    // Handle remove action
    if (action === 'remove') {
      const removed = await removeLegacyUsers(userIds);
      res.json({
        showToast: {
          text: `Removed ${removed} users`,
        },
      });
      return;
    }
  } catch (error) {
    console.error(`Error updating legacy users: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to update',
    });
  }
}
