import { context, redis } from '@devvit/web/server';
import { REDIS_KEYS } from '@server/core/redis';
import { normalizeWord } from '@shared/utils/string';

export async function getHopperPrompts(
  offset: number = 0,
  limit: number = 1000
): Promise<{ prompts: string[]; total: number; hasMore: boolean }> {
  const subName = context.subredditName;
  const key = REDIS_KEYS.tournamentHopper(subName);
  const [entities, total] = await Promise.all([
    redis.global.zRange(key, offset, offset + limit - 1),
    redis.global.zCard(key),
  ]);
  const prompts = entities.map((e) => e.member);
  return { prompts, total, hasMore: offset + limit < total };
}

export async function replaceHopperPrompts(prompts: string[]): Promise<void> {
  const subName = context.subredditName;
  const key = REDIS_KEYS.tournamentHopper(subName);
  await redis.global.del(key);
  if (prompts.length === 0) return;
  await addHopperPrompts(prompts);
}

export async function addHopperPrompts(prompts: string[]): Promise<void> {
  const subName = context.subredditName;
  const key = REDIS_KEYS.tournamentHopper(subName);
  const now = Date.now();
  const normalized = prompts
    .map((p) => normalizeWord(p))
    .filter((p) => p && p.length > 0);
  if (normalized.length === 0) return;
  await redis.global.zAdd(
    key,
    ...normalized.map((p, idx) => ({ member: p, score: now + idx }))
  );
}

export async function peekNextHopperPrompt(): Promise<string | null> {
  const subName = context.subredditName;
  const key = REDIS_KEYS.tournamentHopper(subName);
  const result = await redis.global.zRange(key, 0, 0);
  if (result.length === 0) return null;
  return result[0]!.member;
}

export async function removeHopperPrompt(prompt: string): Promise<boolean> {
  const subName = context.subredditName;
  const key = REDIS_KEYS.tournamentHopper(subName);
  const normalized = normalizeWord(prompt);
  const removed = await redis.global.zRem(key, [normalized]);
  return removed > 0;
}
