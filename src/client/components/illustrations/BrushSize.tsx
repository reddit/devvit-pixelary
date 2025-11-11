import type { IllustrationProps } from './types';

type BrushSize = 'small' | 'medium' | 'large';
type BrushVariant = 'on' | 'off';

const ACCENT_COLOR = '#EB5757';

export function BrushSize({
  size = 12,
  title = 'Brush Size',
  className = '',
  brushSize = 'small',
  brushVariant = 'on',
  ...props
}: IllustrationProps & { brushSize?: BrushSize; brushVariant?: BrushVariant }) {
  return (
    <svg
      fill="none"
      height={size}
      width={size}
      viewBox="0 0 12 12"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      className={className}
      aria-label={`${brushSize} brush size`}
      role="img"
      {...props}
    >
      {/* Size: Large, Variant: Off */}
      {brushSize === 'large' && brushVariant === 'off' && (
        <>
          <path d="M10 10H2V2H10V10Z" fill="white" fillOpacity="0.4" />
          <path
            d="M10 11H2V10H10V11ZM2 10H1V2H2V10ZM11 10H10V2H11V10ZM10 2H2V1H10V2Z"
            fill="black"
            fillOpacity="0.5"
          />
          <path d="M10 10H2V9H9V2H10V10Z" fill="black" fillOpacity="0.25" />
          <path d="M3 8H2V2H8V3H3V8Z" fill="white" fillOpacity="0.4" />
        </>
      )}

      {/* Size: Large, Variant: On */}
      {brushSize === 'large' && brushVariant === 'on' && (
        <>
          <path d="M10 10H2V2H10V10Z" fill={ACCENT_COLOR} />
          <path
            d="M10 11H2V10H10V11ZM2 10H1V2H2V10ZM11 10H10V2H11V10ZM10 2H2V1H10V2Z"
            fill="black"
            fillOpacity="0.8"
          />
          <path d="M10 10H2V9H9V2H10V10Z" fill="black" fillOpacity="0.3" />
          <path d="M3 8H2V2H8V3H3V8Z" fill="white" fillOpacity="0.5" />
        </>
      )}

      {/* Size: Medium, Variant: Off */}
      {brushSize === 'medium' && brushVariant === 'off' && (
        <>
          <path d="M9 9H3V3H9V9Z" fill="white" fillOpacity="0.4" />
          <path
            d="M9 10H3V9H9V10Z M3 9H2V3H3V9Z M10 9H9V3H10V9Z M9 3H3V2H9V3Z"
            fill="black"
            fillOpacity="0.5"
          />
          <path d="M9 9H3V8H8V3H9V9Z" fill="black" fillOpacity="0.25" />
          <path d="M4 7H3V3H7V4H4V7Z" fill="white" fillOpacity="0.4" />
        </>
      )}

      {/* Size: Medium, Variant: On */}
      {brushSize === 'medium' && brushVariant === 'on' && (
        <>
          <path d="M9 9H3V3H9V9Z" fill={ACCENT_COLOR} />
          <path
            d="M9 10H3V9H9V10Z M3 9H2V3H3V9Z M10 9H9V3H10V9Z M9 3H3V2H9V3Z"
            fill="black"
            fillOpacity="0.8"
          />
          <path d="M9 9H3V8H8V3H9V9Z" fill="black" fillOpacity="0.3" />
          <path d="M4 7H3V3H7V4H4V7Z" fill="white" fillOpacity="0.5" />
        </>
      )}

      {/* Size: Small, Variant: Off */}
      {brushSize === 'small' && brushVariant === 'off' && (
        <>
          <path d="M8 8H4V4H8V8Z" fill="white" fillOpacity="0.4" />
          <path
            d="M8 9H4V8H8V9ZM4 8H3V4H4V8ZM9 8H8V4H9V8ZM8 4H4V3H8V4Z"
            fill="black"
            fillOpacity="0.5"
          />
          <path d="M8 8H4V7H7V4H8V8Z" fill="black" fillOpacity="0.25" />
          <path d="M5 6H4V4H6V5H5V6Z" fill="white" fillOpacity="0.4" />
        </>
      )}

      {/* Size: Small, Variant: On */}
      {brushSize === 'small' && brushVariant === 'on' && (
        <>
          <path d="M8 8H4V4H8V8Z" fill={ACCENT_COLOR} />
          <path
            d="M8 9H4V8H8V9ZM4 8H3V4H4V8ZM9 8H8V4H9V8ZM8 4H4V3H8V4Z"
            fill="black"
            fillOpacity="0.8"
          />
          <path d="M8 8H4V7H7V4H8V8Z" fill="black" fillOpacity="0.3" />
          <path d="M5 6H4V4H6V5H5V6Z" fill="white" fillOpacity="0.5" />
        </>
      )}
    </svg>
  );
}
