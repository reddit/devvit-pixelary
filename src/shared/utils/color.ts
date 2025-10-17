import type { HEX, RGB } from '../types';

/**
 * Convert hex color to RGB values
 */

function hexToRgb(hex: HEX): RGB | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1]!, 16),
        g: parseInt(result[2]!, 16),
        b: parseInt(result[3]!, 16),
      }
    : null;
}

/**
 * Calculate relative luminance using WCAG 2.1 formula
 * Returns value between 0 (black) and 1 (white)
 * Based on sRGB color space and ITU-R BT.709 standard
 */

function getRelativeLuminance(color: HEX): number {
  const rgb = hexToRgb(color);
  if (!rgb) return 0.5; // Default to middle gray for invalid colors

  // Convert to linear RGB using sRGB transfer function
  const linearize = (c: number) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  const rLinear = linearize(rgb.r);
  const gLinear = linearize(rgb.g);
  const bLinear = linearize(rgb.b);

  // Calculate relative luminance using ITU-R BT.709 coefficients
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Get contrasting color (black or white) for optimal readability
 * Uses WCAG 2.1 contrast guidelines with perceptual lightness threshold
 * @param backgroundColor Background color
 * @param threshold Threshold for determining lightness (0-1), default 0.5
 * @returns '#000000' for light backgrounds, '#FFFFFF' for dark backgrounds
 */
export function getContrastColor(
  backgroundColor: HEX,
  threshold: number = 0.5
): HEX {
  const luminance = getRelativeLuminance(backgroundColor);
  return luminance > threshold ? '#000000' : '#FFFFFF';
}
