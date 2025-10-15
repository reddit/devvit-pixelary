// Redis Type Definitions for Devvit Environment
// These types ensure type safety for all Redis operations

export type RedisGetResult = string | null;
export type RedisSetResult = 'OK' | null;
export type RedisDelResult = number;
export type RedisExistsResult = number;
export type RedisExpireResult = number;
export type RedisTtlResult = number;

// Hash operations
export type RedisHashValue = Record<string, string>;
export type RedisHGetResult = string | null;
export type RedisHGetAllResult = Record<string, string>;
export type RedisHSetResult = number;
export type RedisHDelResult = number;

// Set operations
export type RedisSetMember = string;
export type RedisSAddResult = number;
export type RedisSIsMemberResult = number;
export type RedisSMembersResult = string[];
export type RedisSCardResult = number;

// Sorted Set operations
export type RedisZSetMember = { member: string; score: number };
export type RedisZAddResult = number;
export type RedisZScoreResult = number | null;
export type RedisZRankResult = number | null;
export type RedisZCardResult = number;
export type RedisZIncrByResult = number;
export type RedisZRangeResult = string[];
export type RedisZRevRangeResult = string[];
export type RedisZRangeWithScoresResult = RedisZSetMember[];
export type RedisZRevRangeWithScoresResult = RedisZSetMember[];

// List operations
export type RedisListValue = string[];
export type RedisLPushResult = number;
export type RedisRPushResult = number;
export type RedisLPopResult = string | null;
export type RedisRPopResult = string | null;
export type RedisLLenResult = number;

// Pipeline operations
export type RedisPipelineResult = Array<unknown>;

// Devvit-specific context types
export type DevvitPostData = {
  seed?: string;
  mode?: string;
  createdAt?: number;
  timerSec?: number;
  admins?: string[];
};

export type DevvitContext = {
  postData?: DevvitPostData;
  userId?: string;
  subredditId: string;
  postId?: string | null;
  username?: string | null;
};

// Job context for scheduled operations
export type JobContext = DevvitContext & {
  postId: string | null;
  subredditName: string;
};

// Command context for comment commands
export type CommandContext = {
  commentId: string;
  authorName: string;
  subredditName: string;
  timestamp: number;
  source: 'devvit' | 'http' | 'test';
};

// Redis client interface for mocking in tests
export interface MockRedisClient {
  get: (key: string) => Promise<RedisGetResult>;
  set: (
    key: string,
    value: string,
    options?: { expiration?: number }
  ) => Promise<RedisSetResult>;
  del: (key: string) => Promise<RedisDelResult>;
  exists: (key: string) => Promise<RedisExistsResult>;
  expire: (key: string, seconds: number) => Promise<RedisExpireResult>;
  ttl: (key: string) => Promise<RedisTtlResult>;

  // Hash operations
  hGet: (key: string, field: string) => Promise<RedisHGetResult>;
  hGetAll: (key: string) => Promise<RedisHGetAllResult>;
  hSet: (key: string, field: string, value: string) => Promise<RedisHSetResult>;
  hDel: (key: string, field: string) => Promise<RedisHDelResult>;

  // Set operations
  sAdd: (key: string, member: string) => Promise<RedisSAddResult>;
  sIsMember: (key: string, member: string) => Promise<RedisSIsMemberResult>;
  sMembers: (key: string) => Promise<RedisSMembersResult>;
  sCard: (key: string) => Promise<RedisSCardResult>;

  // Sorted set operations
  zAdd: (
    key: string,
    score: number,
    member: string
  ) => Promise<RedisZAddResult>;
  zScore: (key: string, member: string) => Promise<RedisZScoreResult>;
  zRank: (key: string, member: string) => Promise<RedisZRankResult>;
  zRevRank: (key: string, member: string) => Promise<RedisZRankResult>;
  zCard: (key: string) => Promise<RedisZCardResult>;
  zIncrBy: (
    key: string,
    increment: number,
    member: string
  ) => Promise<RedisZIncrByResult>;
  zRange: (
    key: string,
    start: number,
    stop: number
  ) => Promise<RedisZRangeResult>;
  zRevRange: (
    key: string,
    start: number,
    stop: number
  ) => Promise<RedisZRevRangeResult>;
  zRangeWithScores: (
    key: string,
    start: number,
    stop: number
  ) => Promise<RedisZRangeWithScoresResult>;
  zRevRangeWithScores: (
    key: string,
    start: number,
    stop: number
  ) => Promise<RedisZRevRangeWithScoresResult>;

  // List operations
  lPush: (key: string, value: string) => Promise<RedisLPushResult>;
  rPush: (key: string, value: string) => Promise<RedisRPushResult>;
  lPop: (key: string) => Promise<RedisLPopResult>;
  rPop: (key: string) => Promise<RedisRPopResult>;
  lLen: (key: string) => Promise<RedisLLenResult>;

  // Pipeline operations
  pipeline: () => {
    get: (key: string) => PipelineChain;
    set: (key: string, value: string) => PipelineChain;
    del: (key: string) => PipelineChain;
    hGet: (key: string, field: string) => PipelineChain;
    hSet: (key: string, field: string, value: string) => PipelineChain;
    sAdd: (key: string, member: string) => PipelineChain;
    zAdd: (key: string, score: number, member: string) => PipelineChain;
    zIncrBy: (key: string, increment: number, member: string) => PipelineChain;
    exec: () => Promise<RedisPipelineResult>;
  };
}

// Pipeline chain interface for method chaining
interface PipelineChain {
  get: (key: string) => PipelineChain;
  set: (key: string, value: string) => PipelineChain;
  del: (key: string) => PipelineChain;
  hGet: (key: string, field: string) => PipelineChain;
  hSet: (key: string, field: string, value: string) => PipelineChain;
  sAdd: (key: string, member: string) => PipelineChain;
  zAdd: (key: string, score: number, member: string) => PipelineChain;
  zIncrBy: (key: string, increment: number, member: string) => PipelineChain;
  exec: () => Promise<RedisPipelineResult>;
}
