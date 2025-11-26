import type { HEX } from '@shared/types';

type MinimumVersion = {
  yyyy: number;
  release: number;
};

export const MINIMUM_CLIENT_VERSIONS: {
  IOS: MinimumVersion;
  ANDROID: MinimumVersion;
} = {
  IOS: { yyyy: 2025, release: 45 },
  ANDROID: { yyyy: 2025, release: 45 },
};

/**
 * Default color palette - all colors available to all users
 */
export const DRAWING_COLORS: readonly HEX[] = [
  // Grays
  '#FFFFFF', // White
  '#CCCCCC', // Light gray
  '#A6A6A6', // Midlight gray
  '#808080', // Midpoint of gray scale
  '#595959', // Darker gray
  '#4D4D4D', // Darkest gray
  '#000000', // Black

  // Primary
  '#FF4D56', // Red
  '#A15936', // Brown
  '#FF742E', // Orange
  '#FFC71A', // Yellow
  '#00B257', // Green
  '#0082F6', // Blue
  '#A64CE9', // Purple

  // Tints
  '#FFA3C2', // Pink
  '#D29779', // Light brown
  '#FFAA80', // Light orange
  '#FFE8A3', // Light yellow
  '#6EF7B1', // Light green
  '#99CFFF', // Light blue
  '#D2A4F4', // Light purple
] as const;

export const DEFAULT_MRU_COLORS: readonly HEX[] = [
  '#000000', // Black
  '#FFFFFF', // White
  '#FF4D56', // Red
  '#FFC71A', // Yellow
  '#00B257', // Green
  '#0082F6', // Blue
  '#A64CE9', // Purple
] as const;

/**
 * Get available extended colors - returns empty array since all colors are now in DRAWING_COLORS
 */
export function getAvailableExtendedColors(_userLevel: number): HEX[] {
  return [];
}

export function getAllAvailableColors(_userLevel: number): HEX[] {
  return [...DRAWING_COLORS];
}
