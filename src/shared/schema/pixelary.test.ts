import { describe, it } from 'vitest';
import {
  CandidateWordSchema,
  DictionarySchema,
  UserProfileSchema,
  GuessResultSchema,
  PostGuessesSchema,
  UserDataSchema,
  DrawingPostDataExtendedSchema,
  DrawingSubmitInputSchema,
  GuessSubmitInputSchema,
  DictionaryAddInputSchema,
  DictionaryRemoveInputSchema,
  UserDrawingsInputSchema,
  LeaderboardInputSchema,
  GuessStatsInputSchema,
  PostDataInputSchema,
} from '../schema/pixelary';
import {
  expectValidZodSchema,
  expectInvalidZodSchema,
  createMockCandidateWord,
  createMockDictionary,
  createMockUserProfile,
  createMockGuessResult,
  createMockPostGuesses,
  createMockUserData,
  createMockDrawingPostDataExtended,
  createMockDrawingSubmitInput,
  createMockGuessSubmitInput,
  createMockDictionaryAddInput,
  createMockDictionaryRemoveInput,
  createMockUserDrawingsInput,
  createMockLeaderboardInput,
  createMockGuessStatsInput,
  createMockPostDataInput,
} from '../test-utils';

describe('Pixelary Schema Validation', () => {
  describe('CandidateWord', () => {
    it('validates correct candidate word', () => {
      const validData = createMockCandidateWord();
      expectValidZodSchema(CandidateWordSchema, validData);
    });

    it('rejects invalid candidate word', () => {
      const invalidData = { word: 123, dictionaryName: 'main' };
      expectInvalidZodSchema(CandidateWordSchema, invalidData);
    });

    it('requires word field', () => {
      const invalidData = { dictionaryName: 'main' };
      expectInvalidZodSchema(CandidateWordSchema, invalidData);
    });

    it('requires dictionaryName field', () => {
      const invalidData = { word: 'test' };
      expectInvalidZodSchema(CandidateWordSchema, invalidData);
    });
  });

  describe('Dictionary', () => {
    it('validates correct dictionary', () => {
      const validData = createMockDictionary();
      expectValidZodSchema(DictionarySchema, validData);
    });

    it('rejects non-object dictionary', () => {
      const invalidData = 'not an object';
      expectInvalidZodSchema(DictionarySchema, invalidData);
    });

    it('accepts empty dictionary', () => {
      const validData = { name: 'test', words: [] };
      expectValidZodSchema(DictionarySchema, validData);
    });
  });

  describe('UserProfile', () => {
    it('validates correct user profile', () => {
      const validData = createMockUserProfile();
      expectValidZodSchema(UserProfileSchema, validData);
    });

    it('rejects invalid username', () => {
      const invalidData = createMockUserProfile({ username: 123 as never });
      expectInvalidZodSchema(UserProfileSchema, invalidData);
    });

    it('accepts negative score', () => {
      const validData = createMockUserProfile({ score: -1 });
      expectValidZodSchema(UserProfileSchema, validData);
    });

    it('accepts level 0', () => {
      const validData = createMockUserProfile({ level: 0 });
      expectValidZodSchema(UserProfileSchema, validData);
    });
  });

  describe('GuessResult', () => {
    it('validates correct guess result', () => {
      const validData = createMockGuessResult();
      expectValidZodSchema(GuessResultSchema, validData);
    });

    it('rejects invalid boolean fields', () => {
      const invalidData = createMockGuessResult({ correct: 'yes' as never });
      expectInvalidZodSchema(GuessResultSchema, invalidData);
    });

    it('accepts negative points', () => {
      const validData = createMockGuessResult({ points: -1 });
      expectValidZodSchema(GuessResultSchema, validData);
    });
  });

  describe('PostGuessesSchema', () => {
    it('validates correct post guesses', () => {
      const validData = createMockPostGuesses();
      expectValidZodSchema(PostGuessesSchema, validData);
    });

    it('rejects invalid guesses object', () => {
      const invalidData = createMockPostGuesses({
        guesses: 'not an object' as never,
      });
      expectInvalidZodSchema(PostGuessesSchema, invalidData);
    });

    it('accepts negative counts', () => {
      const validData = createMockPostGuesses({ guessCount: -1 });
      expectValidZodSchema(PostGuessesSchema, validData);
    });
  });

  describe('UserDataSchema', () => {
    it('validates correct user data', () => {
      const validData = createMockUserData();
      expectValidZodSchema(UserDataSchema, validData);
    });

    it('accepts negative guessCount', () => {
      const validData = createMockUserData({ guessCount: -1 });
      expectValidZodSchema(UserDataSchema, validData);
    });

    it('accepts negative score', () => {
      const validData = createMockUserData({ score: -1 });
      expectValidZodSchema(UserDataSchema, validData);
    });
  });

  describe('DrawingPostDataExtendedSchema', () => {
    it('validates correct drawing post data', () => {
      const validData = createMockDrawingPostDataExtended();
      expectValidZodSchema(DrawingPostDataExtendedSchema, validData);
    });

    it('rejects invalid postId', () => {
      const invalidData = createMockDrawingPostDataExtended({
        postId: 123 as never,
      });
      expectInvalidZodSchema(DrawingPostDataExtendedSchema, invalidData);
    });

    it('rejects invalid authorId', () => {
      const invalidData = createMockDrawingPostDataExtended({
        authorId: 123 as never,
      });
      expectInvalidZodSchema(DrawingPostDataExtendedSchema, invalidData);
    });
  });

  describe('Input Schemas', () => {
    it('validates DrawingSubmitInputSchema', () => {
      const validData = createMockDrawingSubmitInput();
      expectValidZodSchema(DrawingSubmitInputSchema, validData);
    });

    it('validates GuessSubmitInputSchema', () => {
      const validData = createMockGuessSubmitInput();
      expectValidZodSchema(GuessSubmitInputSchema, validData);
    });

    it('validates DictionaryAddInputSchema', () => {
      const validData = createMockDictionaryAddInput();
      expectValidZodSchema(DictionaryAddInputSchema, validData);
    });

    it('validates DictionaryRemoveInputSchema', () => {
      const validData = createMockDictionaryRemoveInput();
      expectValidZodSchema(DictionaryRemoveInputSchema, validData);
    });

    it('validates UserDrawingsInputSchema', () => {
      const validData = createMockUserDrawingsInput();
      expectValidZodSchema(UserDrawingsInputSchema, validData);
    });

    it('validates LeaderboardInputSchema', () => {
      const validData = createMockLeaderboardInput();
      expectValidZodSchema(LeaderboardInputSchema, validData);
    });

    it('validates GuessStatsInputSchema', () => {
      const validData = createMockGuessStatsInput();
      expectValidZodSchema(GuessStatsInputSchema, validData);
    });

    it('validates PostDataInputSchema', () => {
      const validData = createMockPostDataInput();
      expectValidZodSchema(PostDataInputSchema, validData);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty strings appropriately', () => {
      const validData = createMockCandidateWord({ word: '' });
      expectValidZodSchema(CandidateWordSchema, validData);
    });

    it('handles zero values appropriately', () => {
      const validData = createMockUserProfile({ score: 0, level: 1 });
      expectValidZodSchema(UserProfileSchema, validData);
    });

    it('handles large numbers appropriately', () => {
      const validData = createMockUserProfile({ score: 999999 });
      expectValidZodSchema(UserProfileSchema, validData);
    });

    it('handles special characters in strings', () => {
      const validData = createMockCandidateWord({
        word: 'test-word_with.special@chars!',
      });
      expectValidZodSchema(CandidateWordSchema, validData);
    });
  });
});
