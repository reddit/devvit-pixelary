import type { IllustrationProps } from './types';

type Variant = 'on' | 'off';
type BrushSize = 'none' | 'small' | 'medium' | 'large';

const PAINT_COLOR = '#FF4500';
const HANDLE_COLOR = '#B27F4D';

export function PaintBrush({
  size = 12,
  title = 'Paint Brush',
  className = '',
  variant = 'on',
  brushSize = 'none',
  ...props
}: IllustrationProps & {
  variant?: Variant;
  brushSize?: BrushSize;
}) {
  return (
    <svg
      fill="none"
      height={size}
      width={size}
      viewBox="0 0 12 12"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      className={className}
      aria-label={`${brushSize} paint brush (${variant})`}
      role="img"
      {...props}
    >
      {/* Brush: On */}
      {variant === 'on' && (
        <>
          <path
            d="M3 12H1V11H3V12Z M1 11H0V9H1V11Z M4 11H3V10H4V11Z M5 10H4V9H5V10Z M2 9H1V8H2V9Z M6 9H5V8H6V9Z M3 8H2V7H3V8Z M7 8H6V7H7V8Z M4 7H3V6H4V7Z M9 7H7V6H9V7Z M5 6H4V5H5V6Z M7 6H6V5H7V6Z M11 5H10V6H9V4H11V5Z M6 5H5V3H6V5Z M12 4H11V1H12V4Z M7 3H6V2H7V3Z M10 2H7V1H10V2Z M11 1H10V0H11V1Z"
            fill="black"
            fillOpacity="0.8"
          />
          <path
            d="M6 6H7V7H6V8H5V9H4V10H3V11H1V9H2V8H3V7H4V6H5V5H6V6Z"
            fill={HANDLE_COLOR}
          />
          <path d="M11 4H9V6H7V5H6V3H7V2H10V1H11V4Z" fill={PAINT_COLOR} />
          <path
            d="M3 11H1V10H3V11Z M4 10H3V9H4V10Z M5 9H4V8H5V9Z M6 8H5V7H6V8Z M7 7H6V6H7V7Z M9 6H7V5H8V4H9V6Z M11 4H10V3H11V4Z"
            fill="black"
            fillOpacity="0.3"
          />
          <path
            d="M7 4H6V3H7V4Z M9 3H7V2H9V3Z"
            fill="white"
            fillOpacity="0.5"
          />
        </>
      )}

      {/* Brush: Off */}
      {variant === 'off' && (
        <>
          <path
            d="M3 12H1V11H3V12Z M1 11H0V9H1V11Z M4 11H3V10H4V11Z M5 10H4V9H5V10Z M2 9H1V8H2V9Z M6 9H5V8H6V9Z M3 8H2V7H3V8Z M7 8H6V7H7V8Z M4 7H3V6H4V7Z M9 7H7V6H9V7Z M5 6H4V5H5V6Z M7 6H6V5H7V6Z M11 5H10V6H9V4H11V5Z M6 5H5V3H6V5Z M12 4H11V1H12V4Z M7 3H6V2H7V3Z M10 2H7V1H10V2Z M11 1H10V0H11V1Z"
            fill="black"
            fillOpacity="0.5"
          />
          <path
            d="M6 6H7V7H6V8H5V9H4V10H3V11H1V9H2V8H3V7H4V6H5V5H6V6Z M11 4H9V6H7V5H6V3H7V2H10V1H11V4Z"
            fill="white"
            fillOpacity="0.4"
          />
          <path
            d="M3 11H1V10H3V11Z M4 10H3V9H4V10Z M5 9H4V8H5V9Z M6 8H5V7H6V8Z M7 7H6V6H7V7Z M9 6H7V5H8V4H9V6Z M11 4H10V3H11V4Z"
            fill="black"
            fillOpacity="0.25"
          />
          <path
            d="M7 4H6V3H7V4Z M9 3H7V2H9V3Z"
            fill="white"
            fillOpacity="0.4"
          />
        </>
      )}

      {/* Brush: Small On */}
      {brushSize === 'small' && variant === 'on' && (
        <>
          <path
            d="M11 12H10V11H11V12Z M10 11H9V10H10V11Z M12 11H11V10H12V11Z M11 10H10V9H11V10Z"
            fill="black"
            fillOpacity="0.8"
          />
          <path d="M11 11H10V10H11V11Z" fill={PAINT_COLOR} />
        </>
      )}

      {/* Brush: Small Off */}
      {brushSize === 'small' && variant === 'off' && (
        <>
          <path
            d="M11 12H10V11H11V12Z M10 11H9V10H10V11Z M12 11H11V10H12V11Z M11 10H10V9H11V10Z"
            fill="black"
            fillOpacity="0.5"
          />
          <path d="M11 11H10V10H11V11Z" fill="white" fillOpacity="0.4" />
        </>
      )}

      {/* Brush: Medium On */}
      {brushSize === 'medium' && variant === 'on' && (
        <>
          <path
            d="M11 12H9V11H11V12Z M9 11H8V9H9V11Z M12 11H11V9H12V11Z M11 9H9V8H11V9Z"
            fill="black"
            fillOpacity="0.8"
          />
          <path d="M11 11H9V9H11V11Z" fill={PAINT_COLOR} />
          <path d="M10 10H9V9H10V10Z" fill="white" fillOpacity="0.5" />
          <path d="M11 11H10V10H11V11Z" fill="black" fillOpacity="0.3" />
        </>
      )}

      {/* Brush: Medium Off */}
      {brushSize === 'medium' && variant === 'off' && (
        <>
          <path
            d="M11 12H9V11H11V12Z M9 11H8V9H9V11Z M12 11H11V9H12V11Z M11 9H9V8H11V9Z"
            fill="black"
            fillOpacity="0.5"
          />
          <path
            d="M11 11H9V9H11V11Z M10 10H9V9H10V10Z"
            fill="white"
            fillOpacity="0.4"
          />
          <path d="M11 11H10V10H11V11Z" fill="black" fillOpacity="0.25" />
        </>
      )}

      {/* Brush: Large On */}
      {brushSize === 'large' && variant === 'on' && (
        <>
          <path d="M11 11H8V8H11V11Z" fill={PAINT_COLOR} />
          <path d="M11 11H9V10H11V11Z" fill="black" fillOpacity="0.3" />
          <path d="M10 9H8V8H10V9Z" fill="white" fillOpacity="0.5" />
          <path
            d="M11 12H8V11H11V12Z M8 11H7V8H8V11Z M12 11H11V8H12V11Z M11 8H8V7H11V8Z"
            fill="black"
            fillOpacity="0.8"
          />
        </>
      )}

      {/* Brush: Large Off */}
      {brushSize === 'large' && variant === 'off' && (
        <>
          <path d="M11 11H8V8H11V11Z" fill="white" fillOpacity="0.4" />
          <path d="M11 11H9V10H11V11Z" fill="black" fillOpacity="0.25" />
          <path d="M10 9H8V8H10V9Z" fill="white" fillOpacity="0.4" />
          <path
            d="M11 12H8V11H11V12Z M8 11H7V8H8V11Z M12 11H11V8H12V11Z M11 8H8V7H11V8Z"
            fill="black"
            fillOpacity="0.5"
          />
        </>
      )}
    </svg>
  );
}
