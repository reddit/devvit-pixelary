import type { IllustrationProps } from './types';

type variant = 'on' | 'off';

export function PaintBrush({
  size = 12,
  title = 'Paint Brush',
  className = '',
  variant = 'on',
  ...props
}: IllustrationProps & {
  variant?: variant;
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
      aria-label={`${variant} paint brush`}
      role="img"
      {...props}
    >
      {/* Variant: Off */}
      {variant === 'off' && (
        <>
          <path
            d="M1 11H3V12H0V9H1V11Z M4 11H3V10H4V11Z M11 11H9V10H11V11Z M5 10H4V9H5V10Z M9 10H8V8H9V10Z M12 10H11V7H12V10Z M2 9H1V8H2V9Z M6 9H5V8H6V9Z M3 8H2V7H3V8Z M7 8H6V7H7V8Z M10 8H9V7H10V8Z M4 7H3V6H4V7Z M9 7H7V6H9V7Z M11 7H10V6H11V7Z M5 6H4V5H5V6Z M7 6H6V5H7V6Z M10 6H9V4H10V6Z M6 5H5V3H6V5Z M11 4H10V3H11V4Z M7 3H6V2H7V3Z M12 3H11V1H10V2H7V1H9V0H12V3Z"
            fill="black"
            fillOpacity="0.5"
          />
          <path
            d="M3 11H1V10H3V11Z M4 10H3V9H4V10Z M11 10H10V9H11V10Z M5 9H4V8H5V9Z M6 8H5V7H6V8Z M7 7H6V6H7V7Z M9 6H7V5H8V4H9V6Z M11 3H10V2H11V3Z"
            fill="black"
            fillOpacity="0.25"
          />
          <path
            d="M6 6H7V7H6V8H5V9H4V10H3V11H1V9H2V8H3V7H4V6H5V5H6V6Z M11 10H9V8H10V7H11V10Z M11 3H10V4H9V6H7V5H6V3H7V2H10V1H11V3Z M10 9H9V8H10V9Z M11 8H10V7H11V8Z M7 4H6V3H7V4Z M9 3H7V2H9V3Z"
            fill="white"
            fillOpacity="0.4"
          />
        </>
      )}

      {/* Variant: On */}
      {variant === 'on' && (
        <>
          <path
            d="M1 11H3V12H0V9H1V11Z M4 11H3V10H4V11Z M11 11H9V10H11V11Z M5 10H4V9H5V10Z M9 10H8V8H9V10Z M12 10H11V7H12V10Z M2 9H1V8H2V9Z M6 9H5V8H6V9Z M3 8H2V7H3V8Z M7 8H6V7H7V8Z M10 8H9V7H10V8Z M4 7H3V6H4V7Z M9 7H7V6H9V7Z M11 7H10V6H11V7Z M5 6H4V5H5V6Z M7 6H6V5H7V6Z M10 6H9V4H10V6Z M6 5H5V3H6V5Z M11 4H10V3H11V4Z M7 3H6V2H7V3Z"
            fill="black"
            fillOpacity="0.8"
          />
          <path
            d="M12 3H11V1H10V2H7V1H9V0H12V3Z"
            fill="black"
            fillOpacity="0.8"
          />
          <path
            d="M6 6H7V7H6V8H5V9H4V10H3V11H1V9H2V8H3V7H4V6H5V5H6V6Z"
            fill="#27AE60"
          />
          <path
            d="M11 10H9V8H10V7H11V10Z M11 3H10V4H9V6H7V5H6V3H7V2H10V1H11V3Z"
            fill="#FAECD1"
          />
          <path
            d="M3 11H1V10H3V11Z M4 10H3V9H4V10Z M11 10H10V9H11V10Z M5 9H4V8H5V9Z M6 8H5V7H6V8Z M7 7H6V6H7V7Z M9 6H7V5H8V4H9V6Z M11 3H10V2H11V3Z"
            fill="black"
            fillOpacity="0.3"
          />
          <path
            d="M10 9H9V8H10V9Z M11 8H10V7H11V8Z M7 4H6V3H7V4Z M9 3H7V2H9V3Z"
            fill="white"
            fillOpacity="0.5"
          />
        </>
      )}
    </svg>
  );
}
