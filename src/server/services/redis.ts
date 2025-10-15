import { redis, context } from '@devvit/web/server';
import { RedisKeyFactory } from './redis-factory';

export { redis };
import type {
  DevvitContext,
  DevvitPostData,
  RedisGetResult,
  RedisSetResult,
} from '../types/redis';

export function keyPost(postId: string | null, suffix: string) {
  return RedisKeyFactory.postKey(postId, suffix);
}

export async function getConfig(postId: string | null) {
  // Prefer post data when available for per-post config (no extra IO)
  const devvitContext = context as unknown as DevvitContext;
  const pd = devvitContext.postData;
  if (pd && typeof pd === 'object') {
    return {
      seed: pd.seed,
      mode: pd.mode,
      createdAt: pd.createdAt,
      timerSec: pd.timerSec,
      admins: Array.isArray(pd.admins) ? pd.admins : undefined,
    };
  }
  // Fallback to Redis cache
  const raw = await redis.get(keyPost(postId, 'config'));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DevvitPostData;
    return parsed;
  } catch {
    return null;
  }
}

export async function cacheConfig(
  postId: string | null,
  config: DevvitPostData
) {
  await redis.set(keyPost(postId, 'config'), JSON.stringify(config));
}

// Pinned post tracking functions
export async function getPinnedPost(
  subredditName: string
): Promise<RedisGetResult> {
  const pinnedPostId = await redis.get(`subreddit:${subredditName}:pinned`);
  return pinnedPostId ?? null;
}

export async function setPinnedPost(
  subredditName: string,
  postId: string
): Promise<string> {
  const result = await redis.set(`subreddit:${subredditName}:pinned`, postId);
  return result ?? '';
}

export async function unpinPost(subredditName: string): Promise<number> {
  const result = await redis.del(`subreddit:${subredditName}:pinned`);
  return result ?? 0;
}

export async function getStats(
  postId: string | null
): Promise<{ plays: number; completions: number; activeUsers: number }> {
  const h = await redis.hGetAll(keyPost(postId, 'stats'));
  const plays = Number(h.plays ?? 0);
  const completions = Number(h.completions ?? 0);
  // presence is tracked in a sorted set by last seen timestamp
  const activeUsers = await redis.zCard(keyPost(postId, 'presence'));
  return { plays, completions, activeUsers };
}

export async function refreshPresence(
  postId: string | null,
  username: string | null
): Promise<{ ok: false } | { ok: true; activeUsers: number }> {
  if (!username) return { ok: false };
  const presenceKey = keyPost(postId, 'presence');
  const now = Math.floor(Date.now() / 1000);
  const ttl = 30; // seconds
  // remove expired members
  await redis.zRemRangeByScore(presenceKey, 0, now - ttl);
  // upsert current user with current timestamp
  await redis.zAdd(presenceKey, { member: username, score: now });
  // set key TTL so it goes away when unused
  await redis.expire(presenceKey, ttl);
  const activeUsers = await redis.zCard(presenceKey);
  return { ok: true, activeUsers };
}

export async function saveDrawing(
  ctx: { postId: string | null; username: string | null },
  input: { rev: number; delta?: unknown }
): Promise<{ ok: false } | { rev: number }> {
  if (!ctx.username) return { ok: false };
  const key = keyPost(ctx.postId, `drawing:${ctx.username}`);
  const currentRevStr = (await redis.hGet(key, 'rev')) ?? '0';
  const currentRev = Number(currentRevStr);
  const nextRev = Math.max(currentRev + 1, input.rev);
  const json = JSON.stringify(input.delta ?? []);
  // Chunk if large
  const CHUNK_THRESHOLD = 300_000; // chars
  const CHUNK_SIZE = 100_000; // chars
  const oldPartsStr = (await redis.hGet(key, 'parts')) ?? '0';
  const oldParts = Number(oldPartsStr);
  if (json.length > CHUNK_THRESHOLD) {
    const pieces = chunkString(json, CHUNK_SIZE);
    const parts = pieces.length;
    for (let i = 0; i < parts; i++) {
      await redis.set(`${key}:part:${i}`, pieces[i]!);
    }
    await redis.hSet(key, {
      rev: String(nextRev),
      storage: 'chunked',
      parts: String(parts),
      data: '',
    });
    if (oldParts > parts) {
      for (let i = parts; i < oldParts; i++) {
        await redis.del(`${key}:part:${i}`);
      }
    }
  } else {
    // Inline
    await redis.hSet(key, {
      rev: String(nextRev),
      storage: 'inline',
      parts: '0',
      data: json,
    });
    if (oldParts > 0) {
      for (let i = 0; i < oldParts; i++) {
        await redis.del(`${key}:part:${i}`);
      }
    }
  }
  await redis.zAdd(keyPost(ctx.postId, 'users'), {
    member: ctx.username,
    score: 0,
  });
  return { rev: nextRev };
}

export async function getDrawing(
  ctx: { postId: string | null },
  username: string | null
): Promise<{ rev: number; strokes: unknown[] }> {
  if (!username) return { rev: 0, strokes: [] };
  const key = keyPost(ctx.postId, `drawing:${username}`);
  const [revStr, storage, partsStr, data] = await Promise.all([
    redis.hGet(key, 'rev'),
    redis.hGet(key, 'storage'),
    redis.hGet(key, 'parts'),
    redis.hGet(key, 'data'),
  ]);
  const rev = Number(revStr ?? '0');
  let json = data ?? '';
  const parts = Number(partsStr ?? '0');
  if (storage === 'chunked' || parts > 0) {
    const chunks: string[] = [];
    for (let i = 0; i < parts; i++) {
      const s = await redis.get(`${key}:part:${i}`);
      if (s) chunks.push(s);
    }
    json = joinChunks(chunks);
  }
  const strokes = json ? (JSON.parse(json) as unknown[]) : [];
  return { rev, strokes };
}

export async function clearDrawing(ctx: {
  postId: string | null;
  username: string | null;
}) {
  if (!ctx.username) return { ok: false as const };
  const key = keyPost(ctx.postId, `drawing:${ctx.username}`);
  await redis.del(key);
  return { ok: true as const };
}

export async function submitScore(
  ctx: { postId: string | null; username: string | null },
  score: number
) {
  if (!ctx.username) return { ok: false as const };
  await redis.zAdd(keyPost(ctx.postId, 'leaderboard'), {
    member: ctx.username,
    score,
  });
  await redis.hIncrBy(keyPost(ctx.postId, 'stats'), 'plays', 1);
  return { ok: true as const };
}

export async function getTop(postId: string | null, limit: number) {
  const key = keyPost(postId, 'leaderboard');
  const count = await redis.zCard(key);
  const start = Math.max(0, count - limit);
  const end = Math.max(0, count - 1);
  const entries = await redis.zRange(key, start, end, { by: 'rank' });
  return entries.map((e) => ({
    username: e.member,
    score: Math.trunc(e.score),
  }));
}

// Game session state per user
export async function setCurrentGame(
  ctx: { postId: string | null; username: string | null },
  state: { prompt: string; endsAt: number; startedAt: number }
) {
  if (!ctx.username) return { ok: false as const };
  const key = keyPost(ctx.postId, `game:${ctx.username}`);
  await redis.hSet(key, {
    prompt: state.prompt,
    endsAt: String(state.endsAt),
    startedAt: String(state.startedAt),
  });
  const ttl = Math.max(30, state.endsAt - Math.floor(Date.now() / 1000) + 60);
  await redis.expire(key, ttl);
  return { ok: true as const };
}

export async function getCurrentGame(ctx: {
  postId: string | null;
  username: string | null;
}): Promise<{ prompt: string; endsAt: number; startedAt: number } | null> {
  if (!ctx.username) return null;
  const key = keyPost(ctx.postId, `game:${ctx.username}`);
  const h = await redis.hGetAll(key);
  if (!h || !h.prompt || !h.endsAt) return null;
  const endsAt = Number(h.endsAt);
  if (!Number.isFinite(endsAt)) return null;
  const startedAt = Number(h.startedAt ?? 0);
  if (endsAt < Math.floor(Date.now() / 1000)) return null;
  return { prompt: h.prompt, endsAt, startedAt };
}

export async function clearCurrentGame(ctx: {
  postId: string | null;
  username: string | null;
}) {
  if (!ctx.username) return { ok: false as const };
  const key = keyPost(ctx.postId, `game:${ctx.username}`);
  await redis.del(key);
  return { ok: true as const };
}

export async function addHistoryEntry(
  ctx: { postId: string | null; username: string | null },
  entry: { prompt: string; score: number; finishedAt: number }
) {
  if (!ctx.username) return { ok: false as const };
  const key = keyPost(ctx.postId, `history:${ctx.username}`);
  await redis.zAdd(key, {
    member: JSON.stringify(entry),
    score: entry.finishedAt,
  });
  await redis.expire(key, 60 * 60 * 24 * 30); // 30 days
  return { ok: true as const };
}

export async function getHistory(
  ctx: { postId: string | null; username: string | null },
  limit: number
) {
  if (!ctx.username)
    return [] as { prompt: string; score: number; finishedAt: number }[];
  const key = keyPost(ctx.postId, `history:${ctx.username}`);
  const count = await redis.zCard(key);
  const start = Math.max(0, count - limit);
  const end = Math.max(0, count - 1);
  const entries = await redis.zRange(key, start, end, { by: 'rank' });
  return entries
    .map((e) => {
      try {
        return JSON.parse(e.member) as {
          prompt: string;
          score: number;
          finishedAt: number;
        };
      } catch {
        return null;
      }
    })
    .filter((x): x is { prompt: string; score: number; finishedAt: number } =>
      Boolean(x)
    );
}

export async function incrementCompletions(postId: string | null) {
  await redis.hIncrBy(keyPost(postId, 'stats'), 'completions', 1);
}

// Simple per-user rate limiting
export async function isRateLimited(
  ctx: { postId: string | null; username: string | null },
  action: string,
  limit: number,
  windowSec: number
): Promise<boolean> {
  if (!ctx.username) return false;
  const key = keyPost(ctx.postId, `rl:${action}:${ctx.username}`);
  const count = await redis.incrBy(key, 1);
  if (count === 1) {
    await redis.expire(key, windowSec);
  }
  return count > limit;
}

// Helpers for chunking (exported for testing)
export function chunkString(input: string, size: number): string[] {
  if (size <= 0) return [input];
  const pieces: string[] = [];
  for (let i = 0; i < input.length; i += size) {
    pieces.push(input.slice(i, i + size));
  }
  return pieces;
}

export function joinChunks(chunks: string[]): string {
  return chunks.join('');
}

// Dictionary seeding and lookup
const DICT_KEY = 'dict:words';

export async function countWords(): Promise<number> {
  return await redis.zCard(DICT_KEY);
}

export async function seedWords(words: readonly string[]): Promise<void> {
  let score = await redis.zCard(DICT_KEY);
  for (const word of words) {
    // zAdd is idempotent for same member; score updated
    await redis.zAdd(DICT_KEY, { member: word, score: score });
    score += 1;
  }
}

export async function getRandomWord(): Promise<string | null> {
  const count = await redis.zCard(DICT_KEY);
  if (count <= 0) return null;
  const rank = Math.floor(Math.random() * count);
  const items = await redis.zRange(DICT_KEY, rank, rank, { by: 'rank' });
  return items[0]?.member ?? null;
}
