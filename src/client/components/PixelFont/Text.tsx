import React, { useMemo } from 'react';
import { getGlyph, getStringWidth, getFontHeight } from './glyphs';

export interface TextProps {
  children: string;
  scale?: number;
  color?: string;
  backgroundColor?: string;
  gap?: number;
  shadow?: boolean;
  shadowColor?: string;
  shadowOffset?: { x: number; y: number };
  className?: string;
  onPress?: () => void;
}

/**
 * PixelFont component - renders as SVG for pixel-perfect text
 * Based on the old Pixelary approach with better developer ergonomics
 */
export function Text({
  children,
  scale = 2,
  color = 'currentColor',
  backgroundColor = 'transparent',
  gap = 1,
  shadow = false,
  shadowColor = 'var(--color-shadow)',
  shadowOffset = { x: 2, y: 2 },
  className = '',
  onPress,
}: TextProps) {
  // Calculate dimensions
  const dimensions = useMemo(() => {
    const width = getStringWidth(children, gap);
    const height = getFontHeight();
    return {
      width: width * scale,
      height: height * scale,
      baseWidth: width,
      baseHeight: height,
    };
  }, [children, gap, scale]);

  // Generate SVG paths for each character
  const svgPaths = useMemo(() => {
    let xOffset = 0;
    const paths: React.ReactNode[] = [];

    for (const char of children) {
      if (char === ' ') {
        xOffset += 6 + gap;
        continue;
      }

      const glyph = getGlyph(char);
      if (!glyph) continue;

      // Add shadow if enabled
      if (shadow) {
        paths.push(
          <path
            key={`shadow-${char}-${xOffset}`}
            d={glyph.path}
            transform={`translate(${xOffset + shadowOffset.x} ${shadowOffset.y})`}
            fill={shadowColor}
            fillRule="evenodd"
            clipRule="evenodd"
          />
        );
      }

      // Add main character
      paths.push(
        <path
          key={`char-${char}-${xOffset}`}
          d={glyph.path}
          transform={`translate(${xOffset} 0)`}
          fill={color}
          fillRule="evenodd"
          clipRule="evenodd"
        />
      );

      xOffset += glyph.width + gap;
    }

    return paths;
  }, [children, color, gap, shadow, shadowColor, shadowOffset]);

  // Render as SVG
  return (
    <svg
      width={dimensions.width}
      height={dimensions.height}
      viewBox={`0 0 ${dimensions.baseWidth} ${dimensions.baseHeight}`}
      className={`select-none image-rendering-pixelated ${className}`.trim()}
      onClick={onPress}
      xmlns="http://www.w3.org/2000/svg"
      aria-label={children}
    >
      {backgroundColor !== 'transparent' && (
        <rect
          width={dimensions.baseWidth}
          height={dimensions.baseHeight}
          fill={backgroundColor}
        />
      )}
      {svgPaths}
    </svg>
  );
}
