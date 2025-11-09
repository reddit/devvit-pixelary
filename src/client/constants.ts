import type { HEX } from '@shared/types';
import { BASE_DRAWING_COLORS } from '@shared/constants';

export const DRAWING_COLORS: readonly HEX[] = BASE_DRAWING_COLORS;

// Tier 1 - Pastels & Skin Tones (14 colors)
// Gradient from lightest to darkest warm pastels
export const TIER_1_COLORS: readonly HEX[] = [
  '#FFF8DC', // cream
  '#F0FFF0', // honeydew
  '#FFE5E5', // light pink
  '#FFB6C1', // light pink
  '#FFC0CB', // pink
  '#F5C6AA', // peach
  '#FFA07A', // light salmon
  '#FFDAB9', // peach puff
  '#FFE4E1', // misty rose
  '#E6E6FA', // lavender
  '#FFFACD', // lemon chiffon
  '#F5DEB3', // wheat
  '#F0E68C', // khaki
  '#DEB887', // burlywood
];

// Tier 2 - Darks & Shadows (14 colors)
// Gradient from lightest gray to darkest
export const TIER_2_COLORS: readonly HEX[] = [
  '#D3D3D3', // light gray
  '#A9A9A9', // dark gray
  '#808080', // gray
  '#708090', // slate gray
  '#6C757D', // medium gray
  '#696969', // dim gray
  '#495057', // dark gray
  '#4A4A4A', // medium dark gray
  '#3C3633', // charcoal
  '#45281F', // dark brown
  '#8B4513', // saddle brown
  '#654321', // dark brown
  '#2C2C2C', // very dark gray
  '#1A1A1A', // very dark
];

// Tier 3 - Vibrants & Neons (14 colors)
// Gradient from cool to warm vibrants
export const TIER_3_COLORS: readonly HEX[] = [
  '#39FF14', // neon green
  '#00FF00', // lime
  '#00FFFF', // cyan
  '#1E90FF', // dodger blue
  '#00FF9F', // spring green
  '#8A2BE2', // blue violet
  '#7CFC00', // lawn green
  '#9400D3', // violet
  '#FF00FF', // magenta
  '#FF1493', // deep pink
  '#FF69B4', // hot pink
  '#FF4500', // orange red
  '#FF8C00', // dark orange
  '#FFD700', // gold
];

// Tier 4 - Earth & Nature (14 colors)
// Gradient from warm earth tones to cool nature tones
export const TIER_4_COLORS: readonly HEX[] = [
  '#B8A882', // sand
  '#D2691E', // chocolate
  '#CD853F', // peru
  '#A0522D', // sienna
  '#8B7355', // beaver
  '#998B7E', // taupe
  '#BC8F8F', // rosy brown
  '#5F7F6F', // gray green
  '#6B8E23', // olive drab
  '#556B2F', // dark olive green
  '#6B7F6A', // sage
  '#7A8178', // mountain
  '#808000', // olive
  '#2F4F4F', // dark slate gray
];

/**
 * Get available extended colors based on user level
 * Level 1: base colors only
 * Level 2: +14 pastels (Tier 1)
 * Level 3: +14 darks (Tier 2)
 * Level 4: +14 vibrants (Tier 3)
 * Level 5: +14 earth tones (Tier 4)
 */
export function getAvailableExtendedColors(userLevel: number): HEX[] {
  const colors: HEX[] = [];

  if (userLevel >= 2) {
    colors.push(...TIER_1_COLORS);
  }
  if (userLevel >= 3) {
    colors.push(...TIER_2_COLORS);
  }
  if (userLevel >= 4) {
    colors.push(...TIER_3_COLORS);
  }
  if (userLevel >= 5) {
    colors.push(...TIER_4_COLORS);
  }

  return colors;
}

export function getAllAvailableColors(userLevel: number): HEX[] {
  return [...DRAWING_COLORS, ...getAvailableExtendedColors(userLevel)];
}
