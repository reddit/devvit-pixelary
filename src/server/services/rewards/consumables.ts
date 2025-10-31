import { redis, realtime } from '@devvit/web/server';
import type { T2 } from '@devvit/shared-types/tid.js';
import { REDIS_KEYS } from '@server/core/redis';
import {
  type ConsumableId,
  type ConsumableEffect,
  getConsumableConfig,
  SCORE_MULTIPLIER_IDS,
} from '@shared/consumables';

export type Inventory = Record<ConsumableId, number>;

export type GrantedItem = {
  itemId: ConsumableId;
  quantity: number;
};

export type ActiveEffectEntry = {
  activationId: string;
  itemId: ConsumableId;
  effect: ConsumableEffect;
  expiresAt: number; // epoch ms
};

function generateActivationId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `act_${Date.now()}_${rand}`;
}

export async function getInventory(userId: T2): Promise<Inventory> {
  const key = REDIS_KEYS.userInventory(userId);
  const raw = await redis.hGetAll(key);
  const result: Partial<Inventory> = {};
  Object.entries(raw).forEach(([k, v]) => {
    const id = k as ConsumableId;
    const qty = parseInt(String(v || '0'), 10);
    if (qty > 0) {
      result[id] = qty;
    }
  });
  return result as Inventory;
}

export async function grantItems(
  userId: T2,
  items: GrantedItem[]
): Promise<void> {
  if (items.length === 0) return;
  const key = REDIS_KEYS.userInventory(userId);
  const ops: Promise<unknown>[] = [];
  for (const { itemId, quantity } of items) {
    if (quantity <= 0) continue;
    ops.push(redis.hIncrBy(key, itemId, quantity));
  }
  await Promise.all(ops);
}

export async function activateConsumable(
  userId: T2,
  itemId: ConsumableId
): Promise<{ activationId: string; expiresAt: number } | null> {
  // Check inventory first
  const inv = await getInventory(userId);
  const currentQty = inv[itemId] ?? 0;
  if (currentQty <= 0) {
    return null;
  }

  const config = getConsumableConfig(itemId);
  const activationId = generateActivationId();
  const now = Date.now();
  const expiresAt = now + config.durationMs;

  // Decrement inventory optimistically
  const invKey = REDIS_KEYS.userInventory(userId);
  const newCount = await redis.hIncrBy(invKey, itemId, -1);
  if (newCount < 0) {
    // Revert to zero if race produced negative
    await redis.hSet(invKey, { [itemId]: '0' });
    return null;
  }

  const activationKey = REDIS_KEYS.boostActivation(activationId);
  const setData: Record<string, string> = {
    userId: String(userId),
    itemId,
    expiresAt: String(expiresAt),
  };
  await redis.hSet(activationKey, setData);
  // Set TTL slightly past expiration to allow lazy cleanup
  await redis.expire(activationKey, Math.ceil(config.durationMs / 1000) + 30);

  // Track in user's active set
  await redis.zAdd(REDIS_KEYS.userActiveBoosts(userId), {
    member: activationId as never,
    score: expiresAt as never,
  } as never);

  // Broadcast updated active effects to user-scoped realtime channel
  try {
    const effects = await getActiveEffects(userId);
    await realtime.send(`user-${userId}-rewards`, {
      type: 'effects_updated',
      effects,
      timestamp: Date.now(),
    });
  } catch {
    // Non-blocking: failures here should not affect activation flow
  }

  return { activationId, expiresAt };
}

export async function getActiveEffects(
  userId: T2
): Promise<ActiveEffectEntry[]> {
  const setKey = REDIS_KEYS.userActiveBoosts(userId);
  const now = Date.now();
  const entries = await redis.zRange(setKey, 0, -1, { by: 'rank' });
  const results: ActiveEffectEntry[] = [];
  for (const entry of entries) {
    const activationId = String(entry.member);
    const expiresAt = Number(entry.score);
    if (!expiresAt || expiresAt < now) {
      // Lazy prune expired
      await redis.zRem(setKey, activationId);
      continue;
    }
    const activationData = await redis.hGetAll(
      REDIS_KEYS.boostActivation(activationId)
    );
    const itemId = activationData.itemId as ConsumableId | undefined;
    const expiresAtStr = activationData.expiresAt;
    if (!itemId || !expiresAtStr) {
      // Orphan/missing, prune
      await redis.zRem(setKey, activationId);
      continue;
    }
    const cfg = getConsumableConfig(itemId);
    results.push({
      activationId,
      itemId,
      effect: cfg.effect,
      expiresAt: Number(expiresAtStr),
    });
  }
  return results;
}

export async function getEffectiveScoreMultiplier(userId: T2): Promise<number> {
  const active = await getActiveEffects(userId);
  let maxMultiplier = 1;
  for (const e of active) {
    if (e.effect.kind === 'score_multiplier') {
      if (e.effect.multiplier > maxMultiplier) {
        maxMultiplier = e.effect.multiplier;
      }
    }
  }
  return maxMultiplier;
}

export async function getActiveExtraDrawingTimeSeconds(
  userId: T2
): Promise<number> {
  const active = await getActiveEffects(userId);
  let total = 0;
  for (const e of active) {
    if (e.effect.kind === 'extra_drawing_time') {
      total += e.effect.extraSeconds;
    }
  }
  return total;
}

export function isScoreMultiplier(id: ConsumableId): boolean {
  return SCORE_MULTIPLIER_IDS.includes(id);
}
