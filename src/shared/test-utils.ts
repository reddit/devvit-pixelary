import { z } from 'zod';
import { expect } from 'vitest';
import type {
  CandidateWord,
  Dictionary,
  UserProfile,
  GuessResult,
  CollectionData,
  PostGuesses,
  UserData,
  WordSelectionEvent,
  DrawingPostDataExtended,
  DrawingSubmitInput,
  GuessSubmitInput,
  DictionaryAddInput,
  DictionaryRemoveInput,
  FeaturedCommunityInput,
  UserDrawingsInput,
  LeaderboardInput,
  GuessStatsInput,
  PostDataInput,
  WordSelectionLogInput,
} from './schema/pixelary';

// Zod schema test helpers
export const expectZodValidation = <T>(
  schema: z.ZodSchema<T>,
  validData: T,
  invalidData: unknown
) => {
  return {
    valid: () => {
      const result = schema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    },
    invalid: () => {
      const result = schema.safeParse(invalidData);
      expect(result.success).toBe(false);
    },
  };
};

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

export const createMockCollectionData = (
  overrides: Partial<CollectionData> = {}
): CollectionData => ({
  postId: 't3_test123',
  data: {
    data: 'test-data',
    colors: ['#FFFFFF', '#000000'],
    bg: 0,
    size: 16,
  },
  authorUsername: 'testuser',
  ...overrides,
});

export const createMockPostGuesses = (
  overrides: Partial<PostGuesses> = {}
): PostGuesses => ({
  guesses: { 'test': 5, 'wrong': 2 },
  wordCount: 1,
  guessCount: 7,
  playerCount: 3,
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

export const createMockWordSelectionEvent = (
  overrides: Partial<WordSelectionEvent> = {}
): WordSelectionEvent => ({
  userId: 'testuser123',
  postId: 't3_test123',
  options: [createMockCandidateWord()],
  word: 'test',
  type: 'manual',
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

export const createMockFeaturedCommunityInput = (
  overrides: Partial<FeaturedCommunityInput> = {}
): FeaturedCommunityInput => ({
  subredditName: 'testsubreddit',
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

export const createMockWordSelectionLogInput = (
  overrides: Partial<WordSelectionLogInput> = {}
): WordSelectionLogInput => ({
  postId: 't3_test123',
  options: [createMockCandidateWord()],
  word: 'test',
  type: 'manual',
  ...overrides,
});

// Test data arrays
export const createMockCandidateWords = (count: number = 3): CandidateWord[] =>
  Array.from({ length: count }, (_, i) =>
    createMockCandidateWord({
      word: `word${i + 1}`,
      dictionaryName: i === 0 ? 'main' : 'special',
    })
  );

export const createMockDrawingData = (size: number = 256): number[] =>
  Array.from({ length: size }, (_, i) => i % 4); // Simple pattern

export const createMockLeaderboardEntries = (count: number = 10) =>
  Array.from({ length: count }, (_, i) => ({
    username: `user${i + 1}`,
    score: (count - i) * 100,
    rank: i + 1,
  }));

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

// Mock pixel data generators
export const createBlankPixelData = (size: number = 256): number[] =>
  new Array(size).fill(-1);

export const createRandomPixelData = (size: number = 256): number[] =>
  Array.from({ length: size }, () => Math.floor(Math.random() * 4));

export const createPatternPixelData = (size: number = 256): number[] =>
  Array.from({ length: size }, (_, i) => {
    const x = i % 16;
    const y = Math.floor(i / 16);
    return (x + y) % 4;
  });
