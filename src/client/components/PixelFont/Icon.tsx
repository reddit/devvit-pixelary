import { getGlyph } from './glyphs';
import type { SupportedGlyph } from './glyphs';

type PixelSymbolProps = {
  type: SupportedGlyph;
  scale?: number;
  color?: string;
  className?: string;
};

export function Icon({
  type,
  scale = 2,
  color = 'currentColor',
  className = '',
}: PixelSymbolProps) {
  const glyph = getGlyph(type);
  if (!glyph) return null;

  const height = glyph.height;
  const width = glyph.width;
  const scaledHeight = height * scale;
  const scaledWidth = width * scale;

  return (
    <svg
      width={scaledWidth}
      height={scaledHeight}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={glyph.path} fill={color} fillRule="evenodd" clipRule="evenodd" />
    </svg>
  );
}
