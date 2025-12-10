import type { T1, T2, T3 } from '@devvit/shared-types/tid.js';
import { cache, redis } from '@devvit/web/server';
import { REDIS_KEYS } from '@server/core/redis';
import type { DrawingData } from '@shared/schema/drawing';
import { getCachedTournamentEntry } from '@server/services/posts/tournament/post';

export type UserArtItem =
  | {
      type: 'drawing';
      id: string; // d:<postId>
      postId: T3;
      drawing: DrawingData;
      createdAt: number;
    }
  | {
      type: 'tournament';
      id: string; // t:<commentId>
      postId: T3;
      commentId: T1;
      drawing: DrawingData;
      createdAt: number;
    };

type ZRangeEntry = { member: string; score: number };

function parseCompositeId(
  compositeId: string
): { kind: 'drawing'; postId: T3 } | { kind: 'tournament'; commentId: T1 } {
  if (compositeId.startsWith('d:')) {
    return { kind: 'drawing', postId: compositeId.slice(2) as T3 };
  }
  if (compositeId.startsWith('t:')) {
    return { kind: 'tournament', commentId: compositeId.slice(2) as T1 };
  }
  // Fallback: treat as drawing identifier
  return { kind: 'drawing', postId: compositeId as unknown as T3 };
}

async function hydrateFromSource(
  userId: T2,
  compositeId: string
): Promise<UserArtItem | undefined> {
  const parsed = parseCompositeId(compositeId);
  if (parsed.kind === 'drawing') {
    const postId = parsed.postId;
    const data = await cache(
      async () => await redis.hGetAll(REDIS_KEYS.drawing(postId)),
      { key: `user_art:src:d:${postId}`, ttl: 30 }
    );
    if (!data?.drawing) return undefined;
    const createdAt =
      (data.createdAt ? parseInt(data.createdAt) : undefined) ?? Date.now();
    // Snapshot listing
    await redis.hSet(REDIS_KEYS.userArtItem(userId, compositeId), {
      type: 'drawing',
      postId,
      drawing: data.drawing,
      createdAt: createdAt.toString(),
    });
    return {
      type: 'drawing',
      id: compositeId,
      postId,
      drawing: JSON.parse(data.drawing) as DrawingData,
      createdAt,
    };
  } else {
    const commentId = parsed.commentId;
    const entry = await getCachedTournamentEntry(commentId);
    if (!entry) return undefined;
    // Snapshot listing
    await redis.hSet(REDIS_KEYS.userArtItem(userId, compositeId), {
      type: 'tournament',
      postId: entry.postId,
      commentId,
      drawing: JSON.stringify(entry.drawing),
      // createdAt is sourced from the zset score at read-time
    });
    return {
      type: 'tournament',
      id: compositeId,
      postId: entry.postId,
      commentId,
      drawing: entry.drawing,
      createdAt: Date.now(), // caller should override with zset score if available
    };
  }
}

async function readSnapshot(
  userId: T2,
  compositeId: string
): Promise<UserArtItem | undefined> {
  const snapshotKey = REDIS_KEYS.userArtItem(userId, compositeId);
  const data = await redis.hGetAll(snapshotKey);
  if (!data?.type || !data?.postId || !data?.drawing) {
    return undefined;
  }
  if (data.type === 'drawing') {
    try {
      const drawing = JSON.parse(data.drawing) as DrawingData;
      return {
        type: 'drawing',
        id: compositeId,
        postId: data.postId as T3,
        drawing,
        createdAt: data.createdAt ? parseInt(data.createdAt) : Date.now(),
      };
    } catch (error) {
      console.error(
        `[readSnapshot] Failed to parse drawing data for ${compositeId}:`,
        error
      );
      return undefined;
    }
  } else {
    if (!data.commentId) {
      return undefined;
    }
    try {
      const drawing = JSON.parse(data.drawing) as DrawingData;
      return {
        type: 'tournament',
        id: compositeId,
        postId: data.postId as T3,
        commentId: data.commentId as T1,
        drawing,
        createdAt: data.createdAt ? parseInt(data.createdAt) : Date.now(),
      };
    } catch (error) {
      console.error(
        `[readSnapshot] Failed to parse tournament drawing data for ${compositeId}:`,
        error
      );
      return undefined;
    }
  }
}

export async function getMyArtPage(options: {
  userId: T2;
  limit: number;
  cursor?: number;
}): Promise<{ items: UserArtItem[]; nextCursor: number }> {
  const { userId, limit, cursor } = options;
  const start = cursor ?? 0;
  const userArtKey = REDIS_KEYS.userArt(userId);
  const raw = (await redis.zRange(userArtKey, start, start + limit - 1, {
    reverse: true,
    by: 'rank',
  })) as ZRangeEntry[];

  if (raw.length === 0) {
    return { items: [], nextCursor: -1 };
  }

  // Guard against mocks or backends returning more than requested
  const page = raw.slice(0, limit);

  const items = await Promise.all(
    page.map(async (entry) => {
      const compositeId = entry.member;
      const createdAt = entry.score;
      // Try snapshot first
      let item = await readSnapshot(userId, compositeId);
      item ??= await hydrateFromSource(userId, compositeId);
      if (!item) return undefined;
      // Ensure createdAt = zset score for consistent ordering
      return { ...item, createdAt };
    })
  );

  const filtered = items.filter(Boolean) as UserArtItem[];
  const totalCount = await redis.zCard(userArtKey);
  const nextCursor =
    start + page.length < totalCount ? start + page.length : -1;
  return { items: filtered, nextCursor };
}
