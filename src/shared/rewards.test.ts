import { describe, it, expect } from 'vitest';
import {
  hasReward,
  getRewardValue,
  getRewardLabel,
  getAllRewards,
  getRewardsByLevel,
  getExtraDrawingTime,
  getExtraWordTime,
} from './rewards';

describe('rewards system', () => {
  describe('hasReward', () => {
    it('returns true when user level meets minimum requirement', () => {
      expect(hasReward(2, 'extra_drawing_time')).toBe(true);
      expect(hasReward(2, 'extra_word_time')).toBe(true);
      expect(hasReward(3, 'add_remove_words')).toBe(true);
      expect(hasReward(2, 'extended_colors_tier_1')).toBe(true);
      expect(hasReward(3, 'extended_colors_tier_2')).toBe(true);
      expect(hasReward(4, 'extended_colors_tier_3')).toBe(true);
      expect(hasReward(5, 'extended_colors_tier_4')).toBe(true);
      expect(hasReward(1, 'level_flair')).toBe(true);
    });

    it('returns false when user level is below minimum requirement', () => {
      expect(hasReward(1, 'extra_drawing_time')).toBe(false);
      expect(hasReward(1, 'extra_word_time')).toBe(false);
      expect(hasReward(2, 'add_remove_words')).toBe(false);
      expect(hasReward(1, 'extended_colors_tier_1')).toBe(false);
      expect(hasReward(2, 'extended_colors_tier_2')).toBe(false);
      expect(hasReward(3, 'extended_colors_tier_3')).toBe(false);
      expect(hasReward(4, 'extended_colors_tier_4')).toBe(false);
      expect(hasReward(0, 'level_flair')).toBe(false);
    });

    it('handles edge cases correctly', () => {
      expect(hasReward(0, 'extra_drawing_time')).toBe(false);
      expect(hasReward(0, 'extra_word_time')).toBe(false);
      expect(hasReward(100, 'extra_drawing_time')).toBe(true);
      expect(hasReward(100, 'extra_word_time')).toBe(true);
      expect(hasReward(-1, 'level_flair')).toBe(false);
    });
  });

  describe('getRewardValue', () => {
    it('returns correct value for extra_drawing_time', () => {
      expect(getRewardValue(2, 'extra_drawing_time')).toBe(15);
      expect(getRewardValue(3, 'extra_drawing_time')).toBe(30);
      expect(getRewardValue(4, 'extra_drawing_time')).toBe(45);
      expect(getRewardValue(10, 'extra_drawing_time')).toBe(135);
    });

    it('returns correct value for extra_word_time', () => {
      expect(getRewardValue(2, 'extra_word_time')).toBe(2);
      expect(getRewardValue(3, 'extra_word_time')).toBe(4);
      expect(getRewardValue(4, 'extra_word_time')).toBe(6);
      expect(getRewardValue(10, 'extra_word_time')).toBe(18);
    });

    it('returns undefined for rewards without values', () => {
      expect(getRewardValue(3, 'add_remove_words')).toBeUndefined();
      expect(getRewardValue(2, 'extended_colors_tier_1')).toBeUndefined();
      expect(getRewardValue(3, 'extended_colors_tier_2')).toBeUndefined();
      expect(getRewardValue(4, 'extended_colors_tier_3')).toBeUndefined();
      expect(getRewardValue(5, 'extended_colors_tier_4')).toBeUndefined();
      expect(getRewardValue(1, 'level_flair')).toBeUndefined();
    });

    it('returns undefined when user level is too low', () => {
      expect(getRewardValue(1, 'extra_drawing_time')).toBeUndefined();
      expect(getRewardValue(1, 'extra_word_time')).toBeUndefined();
      expect(getRewardValue(0, 'extra_drawing_time')).toBeUndefined();
      expect(getRewardValue(0, 'extra_word_time')).toBeUndefined();
    });

    it('handles high levels correctly', () => {
      expect(getRewardValue(20, 'extra_drawing_time')).toBe(285);
      expect(getRewardValue(100, 'extra_drawing_time')).toBe(1485);
      expect(getRewardValue(20, 'extra_word_time')).toBe(38);
      expect(getRewardValue(100, 'extra_word_time')).toBe(198);
    });
  });

  describe('getRewardLabel', () => {
    it('returns correct labels for extra_drawing_time', () => {
      expect(getRewardLabel('extra_drawing_time', 2)).toBe('+15s drawing time');
      expect(getRewardLabel('extra_drawing_time', 3)).toBe('+30s drawing time');
      expect(getRewardLabel('extra_drawing_time', 4)).toBe('+45s drawing time');
      expect(getRewardLabel('extra_drawing_time', 10)).toBe(
        '+135s drawing time'
      );
    });

    it('returns correct labels for extra_word_time', () => {
      expect(getRewardLabel('extra_word_time', 2)).toBe('+2s selection time');
      expect(getRewardLabel('extra_word_time', 3)).toBe('+4s selection time');
      expect(getRewardLabel('extra_word_time', 4)).toBe('+6s selection time');
      expect(getRewardLabel('extra_word_time', 10)).toBe('+18s selection time');
    });

    it('returns static labels for non-computed rewards', () => {
      expect(getRewardLabel('add_remove_words', 3)).toBe('Add/remove words');
      expect(getRewardLabel('add_remove_words', 10)).toBe('Add/remove words');
      expect(getRewardLabel('extended_colors_tier_1', 2)).toBe(
        '+14 pastel colors'
      );
      expect(getRewardLabel('extended_colors_tier_2', 3)).toBe(
        '+14 dark colors'
      );
      expect(getRewardLabel('extended_colors_tier_3', 4)).toBe(
        '+14 vibrant colors'
      );
      expect(getRewardLabel('extended_colors_tier_4', 5)).toBe(
        '+14 earth colors'
      );
      expect(getRewardLabel('level_flair', 1)).toBe('Level user flair');
      expect(getRewardLabel('level_flair', 10)).toBe('Level user flair');
    });

    it('handles edge cases', () => {
      expect(getRewardLabel('extra_drawing_time', 1)).toBe('+0s drawing time');
      expect(getRewardLabel('extra_drawing_time', 0)).toBe('+0s drawing time');
      expect(getRewardLabel('extra_word_time', 1)).toBe('+0s selection time');
      expect(getRewardLabel('extra_word_time', 0)).toBe('+0s selection time');
    });
  });

  describe('getAllRewards', () => {
    it('returns all reward types', () => {
      const rewards = getAllRewards();
      expect(rewards).toHaveLength(8);
      expect(rewards).toContain('extra_drawing_time');
      expect(rewards).toContain('extra_word_time');
      expect(rewards).toContain('add_remove_words');
      expect(rewards).toContain('extended_colors_tier_1');
      expect(rewards).toContain('extended_colors_tier_2');
      expect(rewards).toContain('extended_colors_tier_3');
      expect(rewards).toContain('extended_colors_tier_4');
      expect(rewards).toContain('level_flair');
    });

    it('returns rewards in consistent order', () => {
      const rewards1 = getAllRewards();
      const rewards2 = getAllRewards();
      expect(rewards1).toEqual(rewards2);
    });
  });

  describe('getRewardsByLevel', () => {
    it('returns correct rewards for each level', () => {
      expect(getRewardsByLevel(1)).toEqual(['level_flair']);
      expect(getRewardsByLevel(2)).toEqual([
        'extra_drawing_time',
        'extra_word_time',
        'extended_colors_tier_1',
        'level_flair',
      ]);
      expect(getRewardsByLevel(3)).toEqual([
        'extra_drawing_time',
        'extra_word_time',
        'add_remove_words',
        'extended_colors_tier_1',
        'extended_colors_tier_2',
        'level_flair',
      ]);
      expect(getRewardsByLevel(4)).toEqual([
        'extra_drawing_time',
        'extra_word_time',
        'add_remove_words',
        'extended_colors_tier_1',
        'extended_colors_tier_2',
        'extended_colors_tier_3',
        'level_flair',
      ]);
      expect(getRewardsByLevel(5)).toEqual([
        'extra_drawing_time',
        'extra_word_time',
        'add_remove_words',
        'extended_colors_tier_1',
        'extended_colors_tier_2',
        'extended_colors_tier_3',
        'extended_colors_tier_4',
        'level_flair',
      ]);
    });

    it('handles edge cases', () => {
      expect(getRewardsByLevel(0)).toEqual([]);
      expect(getRewardsByLevel(-1)).toEqual([]);
      expect(getRewardsByLevel(100)).toEqual([
        'extra_drawing_time',
        'extra_word_time',
        'add_remove_words',
        'extended_colors_tier_1',
        'extended_colors_tier_2',
        'extended_colors_tier_3',
        'extended_colors_tier_4',
        'level_flair',
      ]);
    });

    it('returns rewards in consistent order', () => {
      const rewards1 = getRewardsByLevel(4);
      const rewards2 = getRewardsByLevel(4);
      expect(rewards1).toEqual(rewards2);
    });
  });

  describe('getExtraDrawingTime', () => {
    it('returns correct extra time for various levels', () => {
      expect(getExtraDrawingTime(1)).toBe(0);
      expect(getExtraDrawingTime(2)).toBe(15);
      expect(getExtraDrawingTime(3)).toBe(30);
      expect(getExtraDrawingTime(4)).toBe(45);
      expect(getExtraDrawingTime(10)).toBe(135);
    });

    it('handles edge cases', () => {
      expect(getExtraDrawingTime(0)).toBe(0);
      expect(getExtraDrawingTime(-1)).toBe(0);
      expect(getExtraDrawingTime(100)).toBe(1485);
    });

    it('matches getRewardValue for extra_drawing_time', () => {
      for (let level = 0; level <= 20; level++) {
        expect(getExtraDrawingTime(level)).toBe(
          getRewardValue(level, 'extra_drawing_time') ?? 0
        );
      }
    });
  });

  describe('getExtraWordTime', () => {
    it('returns correct extra time for various levels', () => {
      expect(getExtraWordTime(1)).toBe(0);
      expect(getExtraWordTime(2)).toBe(2);
      expect(getExtraWordTime(3)).toBe(4);
      expect(getExtraWordTime(4)).toBe(6);
      expect(getExtraWordTime(10)).toBe(18);
    });

    it('handles edge cases', () => {
      expect(getExtraWordTime(0)).toBe(0);
      expect(getExtraWordTime(-1)).toBe(0);
      expect(getExtraWordTime(100)).toBe(198);
    });

    it('matches getRewardValue for extra_word_time', () => {
      for (let level = 0; level <= 20; level++) {
        expect(getExtraWordTime(level)).toBe(
          getRewardValue(level, 'extra_word_time') ?? 0
        );
      }
    });
  });

  describe('integration tests', () => {
    it('maintains consistency across all functions', () => {
      const testLevels = [1, 2, 3, 4, 5, 10, 20];

      for (const level of testLevels) {
        const hasExtraTime = hasReward(level, 'extra_drawing_time');
        const extraTimeValue = getRewardValue(level, 'extra_drawing_time');
        const extraTimeLabel = getRewardLabel('extra_drawing_time', level);
        const convenienceValue = getExtraDrawingTime(level);

        if (hasExtraTime) {
          expect(extraTimeValue).toBeDefined();
          expect(extraTimeValue).toBeGreaterThan(0);
          expect(convenienceValue).toBe(extraTimeValue);
          expect(extraTimeLabel).toContain(`${extraTimeValue}s`);
        } else {
          expect(extraTimeValue).toBeUndefined();
          expect(convenienceValue).toBe(0);
        }

        const hasExtraWordTime = hasReward(level, 'extra_word_time');
        const extraWordTimeValue = getRewardValue(level, 'extra_word_time');
        const extraWordTimeLabel = getRewardLabel('extra_word_time', level);
        const wordConvenienceValue = getExtraWordTime(level);

        if (hasExtraWordTime) {
          expect(extraWordTimeValue).toBeDefined();
          expect(extraWordTimeValue).toBeGreaterThan(0);
          expect(wordConvenienceValue).toBe(extraWordTimeValue);
          expect(extraWordTimeLabel).toContain(`${extraWordTimeValue}s`);
        } else {
          expect(extraWordTimeValue).toBeUndefined();
          expect(wordConvenienceValue).toBe(0);
        }
      }
    });
  });
});
