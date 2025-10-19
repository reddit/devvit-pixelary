import { z } from 'zod';
import { expect } from 'vitest';
import type {
  CandidateWord,
  Dictionary,
  UserProfile,
  GuessResult,
  PostGuesses,
  UserData,
  DrawingPostDataExtended,
  DrawingSubmitInput,
  GuessSubmitInput,
  DictionaryAddInput,
  DictionaryRemoveInput,
  UserDrawingsInput,
  LeaderboardInput,
  GuessStatsInput,
  PostDataInput,
} from './schema/pixelary';

// Mock data generators
export const createMockCandidateWord = (
  overrides: Partial<CandidateWord> = {}
): CandidateWord => ({
  word: 'test',
  dictionaryName: 'main',
  ...overrides,
});

export const createMockDictionary = (
  overrides: Partial<Dictionary> = {}
): Dictionary => ({
  name: 'main',
  words: ['cat', 'dog', 'tree'],
  ...overrides,
});

export const createMockUserProfile = (
  overrides: Partial<UserProfile> = {}
): UserProfile => ({
  username: 'testuser',
  score: 100,
  level: 1,
  levelName: 'Newcomer',
  rank: 1,
  solved: false,
  skipped: false,
  guessCount: 0,
  userId: 'testuser123',
  ...overrides,
});

export const createMockGuessResult = (
  overrides: Partial<GuessResult> = {}
): GuessResult => ({
  correct: true,
  points: 2,
  isFirstSolve: false,
  totalSolves: 1,
  ...overrides,
});

export const createMockPostGuesses = (
  overrides: Partial<PostGuesses> = {}
): PostGuesses => ({
  guesses: { 'test': 5, 'wrong': 2 },
  wordCount: 1,
  guessCount: 7,
  playerCount: 3,
  solvedCount: 1,
  ...overrides,
});

export const createMockUserData = (
  overrides: Partial<UserData> = {}
): UserData => ({
  score: 100,
  solved: false,
  skipped: false,
  levelRank: 1,
  levelName: 'Newcomer',
  guessCount: 0,
  ...overrides,
});

export const createMockDrawingPostDataExtended = (
  overrides: Partial<DrawingPostDataExtended> = {}
): DrawingPostDataExtended => ({
  type: 'drawing',
  postId: 't3_test123',
  word: 'test',
  dictionary: 'main',
  drawing: {
    data: 'test-data',
    colors: ['#FFFFFF', '#000000'],
    bg: 0,
    size: 16,
  },
  authorId: 'testuser123',
  authorName: 'testuser',
  playerCount: 0,
  solvedPercentage: 0,
  ...overrides,
});

// Input type generators
export const createMockDrawingSubmitInput = (
  overrides: Partial<DrawingSubmitInput> = {}
): DrawingSubmitInput => ({
  word: 'test',
  dictionaryName: 'main',
  data: {
    data: 'test-data',
    colors: ['#FFFFFF', '#000000'],
    bg: 0,
    size: 16,
  },
  ...overrides,
});

export const createMockGuessSubmitInput = (
  overrides: Partial<GuessSubmitInput> = {}
): GuessSubmitInput => ({
  postId: 't3_test123',
  guess: 'test',
  createComment: false,
  ...overrides,
});

export const createMockDictionaryAddInput = (
  overrides: Partial<DictionaryAddInput> = {}
): DictionaryAddInput => ({
  word: 'test',
  ...overrides,
});

export const createMockDictionaryRemoveInput = (
  overrides: Partial<DictionaryRemoveInput> = {}
): DictionaryRemoveInput => ({
  word: 'test',
  ...overrides,
});

export const createMockUserDrawingsInput = (
  overrides: Partial<UserDrawingsInput> = {}
): UserDrawingsInput => ({
  limit: 20,
  ...overrides,
});

export const createMockLeaderboardInput = (
  overrides: Partial<LeaderboardInput> = {}
): LeaderboardInput => ({
  limit: 10,
  ...overrides,
});

export const createMockGuessStatsInput = (
  overrides: Partial<GuessStatsInput> = {}
): GuessStatsInput => ({
  postId: 't3_test123',
  ...overrides,
});

export const createMockPostDataInput = (
  overrides: Partial<PostDataInput> = {}
): PostDataInput => ({
  postId: 't3_test123',
  ...overrides,
});

// Utility functions for testing
export const expectValidZodSchema = <T>(schema: z.ZodSchema<T>, data: T) => {
  const result = schema.safeParse(data);
  expect(result.success).toBe(true);
  return result.success ? result.data : null;
};

export const expectInvalidZodSchema = <T>(
  schema: z.ZodSchema<T>,
  data: unknown
) => {
  const result = schema.safeParse(data);
  expect(result.success).toBe(false);
  return result.success ? null : result.error;
};
