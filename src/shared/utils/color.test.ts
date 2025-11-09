import { describe, it, expect } from 'vitest';
import { getContrastColor, hexToRgb } from './color';

describe('color utilities', () => {
  describe('hexToRgb', () => {
    it('parses 6-digit hex colors', () => {
      expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb('#123456')).toEqual({ r: 18, g: 52, b: 86 });
      expect(hexToRgb('#AaBbCc')).toEqual({ r: 170, g: 187, b: 204 });
    });

    it('parses 3-digit hex colors by expansion', () => {
      expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('#000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb('#0f0')).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb('#f0a')).toEqual({ r: 255, g: 0, b: 170 });
      expect(hexToRgb('#AbC')).toEqual({ r: 170, g: 187, b: 204 });
    });

    it('returns null for invalid hex strings', () => {
      expect(hexToRgb('#gggggg' as `#${string}`)).toBeNull();
      expect(hexToRgb('#12345' as `#${string}`)).toBeNull();
      expect(hexToRgb('#abcd' as `#${string}`)).toBeNull();
      expect(hexToRgb('#' as `#${string}`)).toBeNull();
    });
  });

  describe('getContrastColor', () => {
    it('returns black for light backgrounds', () => {
      expect(getContrastColor('#FFFFFF')).toBe('#000000');
      expect(getContrastColor('#F0F0F0')).toBe('#000000');
      expect(getContrastColor('#CCCCCC')).toBe('#000000');
    });

    it('returns white for dark backgrounds', () => {
      expect(getContrastColor('#000000')).toBe('#FFFFFF');
      expect(getContrastColor('#333333')).toBe('#FFFFFF');
      expect(getContrastColor('#666666')).toBe('#FFFFFF');
    });

    it('handles hex colors with hash', () => {
      expect(getContrastColor('#FFFFFF')).toBe('#000000');
      expect(getContrastColor('#000000')).toBe('#FFFFFF');
    });

    it('handles hex colors without hash', () => {
      expect(getContrastColor('#FFFFFF')).toBe('#000000');
      expect(getContrastColor('#000000')).toBe('#FFFFFF');
    });

    it('uses custom threshold', () => {
      // With default threshold (0.5), this should return white (gray is darker than 0.5)
      expect(getContrastColor('#808080')).toBe('#FFFFFF');

      // With lower threshold, it should return white
      expect(getContrastColor('#808080', 0.3)).toBe('#FFFFFF');

      // With higher threshold, it should return white (still darker than 0.7)
      expect(getContrastColor('#808080', 0.7)).toBe('#FFFFFF');
    });

    it('handles edge case colors', () => {
      // Pure red
      expect(getContrastColor('#FF0000')).toBe('#FFFFFF');

      // Pure green
      expect(getContrastColor('#00FF00')).toBe('#000000');

      // Pure blue
      expect(getContrastColor('#0000FF')).toBe('#FFFFFF');

      // Yellow
      expect(getContrastColor('#FFFF00')).toBe('#000000');

      // Magenta
      expect(getContrastColor('#FF00FF')).toBe('#FFFFFF');

      // Cyan
      expect(getContrastColor('#00FFFF')).toBe('#000000');
    });

    it('handles various gray shades', () => {
      expect(getContrastColor('#FFFFFF')).toBe('#000000'); // White
      expect(getContrastColor('#F5F5F5')).toBe('#000000'); // Very light gray
      expect(getContrastColor('#E0E0E0')).toBe('#000000'); // Light gray
      expect(getContrastColor('#C0C0C0')).toBe('#000000'); // Silver
      expect(getContrastColor('#808080')).toBe('#FFFFFF'); // Gray
      expect(getContrastColor('#404040')).toBe('#FFFFFF'); // Dark gray
      expect(getContrastColor('#202020')).toBe('#FFFFFF'); // Very dark gray
      expect(getContrastColor('#000000')).toBe('#FFFFFF'); // Black
    });

    it('handles invalid hex colors gracefully', () => {
      // Invalid hex should default to middle gray (threshold 0.5)
      expect(getContrastColor('#invalid' as `#${string}`)).toBe('#FFFFFF');
      expect(getContrastColor('#GGGGGG')).toBe('#FFFFFF');
      expect(getContrastColor('#12345' as `#${string}`)).toBe('#FFFFFF');
    });

    it('handles edge threshold values', () => {
      const testColor = '#808080'; // Middle gray

      expect(getContrastColor(testColor, 0)).toBe('#000000');
      expect(getContrastColor(testColor, 1)).toBe('#FFFFFF');
      expect(getContrastColor(testColor, 0.5)).toBe('#FFFFFF');
    });

    it('handles mixed case hex colors', () => {
      expect(getContrastColor('#ffffff')).toBe('#000000');
      expect(getContrastColor('#FFFFFF')).toBe('#000000');
      expect(getContrastColor('#FfFfFf')).toBe('#000000');
      expect(getContrastColor('#000000')).toBe('#FFFFFF');
      expect(getContrastColor('#000000')).toBe('#FFFFFF');
    });
  });
});
