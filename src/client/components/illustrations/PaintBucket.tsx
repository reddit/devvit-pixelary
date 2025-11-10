import type { IllustrationProps } from './types';

type variant = 'on' | 'off';

export function PaintBucket({
  size = 12,
  title = 'Paint Bucket',
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
      aria-label={`${variant} paint bucket`}
      role="img"
      {...props}
    >
      {/* Variant: Off */}
      {variant === 'off' && (
        <>
          <path d="M6 6H5V5H6V6Z" fill="black" fillOpacity="0.5" />
          <path
            d="M9 4H10V5H11V11H9V10H10V6H9V5H8V4H7V3H9V4Z"
            fill="white"
            fillOpacity="0.4"
          />
          <path d="M7 3H6V2H7V3Z" fill="white" fillOpacity="0.4" />
          <path
            d="M5 5H4V6H5V7H6V6H7V5H8V6H9V7H8V8H7V9H6V10H5V11H4V10H3V9H2V8H1V6H2V5H3V4H4V3H5V5Z"
            fill="white"
            fillOpacity="0.4"
          />
          <path d="M7 5H6V4H7V5Z" fill="white" fillOpacity="0.4" />
          <path d="M5 12H4V11H5V12Z" fill="black" fillOpacity="0.5" />
          <path
            d="M12 12H8V10H9V11H11V5H12V12Z"
            fill="black"
            fillOpacity="0.5"
          />
          <path d="M4 11H3V10H4V11Z" fill="black" fillOpacity="0.5" />
          <path d="M6 11H5V10H6V11Z" fill="black" fillOpacity="0.5" />
          <path d="M3 10H2V9H3V10Z" fill="black" fillOpacity="0.5" />
          <path d="M7 10H6V9H7V10Z" fill="black" fillOpacity="0.5" />
          <path d="M10 10H9V8H8V7H9V6H10V10Z" fill="black" fillOpacity="0.5" />
          <path d="M2 9H1V8H2V9Z" fill="black" fillOpacity="0.5" />
          <path d="M8 9H7V8H8V9Z" fill="black" fillOpacity="0.5" />
          <path d="M1 8H0V6H1V8Z" fill="black" fillOpacity="0.5" />
          <path d="M6 7H5V6H6V7Z" fill="black" fillOpacity="0.5" />
          <path d="M2 4H3V5H2V6H1V1H2V4Z" fill="black" fillOpacity="0.5" />
          <path d="M5 6H4V5H5V6Z" fill="black" fillOpacity="0.5" />
          <path d="M7 6H6V5H7V6Z" fill="black" fillOpacity="0.5" />
          <path d="M9 6H8V5H9V6Z" fill="black" fillOpacity="0.5" />
          <path
            d="M6 1H7V2H6V3H7V4H6V5H5V3H4V2H5V1H2V0H6V1Z"
            fill="black"
            fillOpacity="0.5"
          />
          <path d="M8 5H7V4H8V5Z" fill="black" fillOpacity="0.5" />
          <path d="M11 5H10V4H11V5Z" fill="black" fillOpacity="0.5" />
          <path d="M4 4H3V3H4V4Z" fill="black" fillOpacity="0.5" />
          <path d="M10 4H9V3H10V4Z" fill="black" fillOpacity="0.5" />
          <path d="M9 3H7V2H9V3Z" fill="black" fillOpacity="0.5" />
          <path d="M5 11H4V10H5V11Z" fill="black" fillOpacity="0.25" />
          <path d="M11 11H9V10H11V11Z" fill="black" fillOpacity="0.25" />
          <path d="M6 10H5V9H6V10Z" fill="black" fillOpacity="0.25" />
          <path d="M7 9H6V8H7V9Z" fill="black" fillOpacity="0.25" />
          <path d="M8 8H7V7H8V8Z" fill="black" fillOpacity="0.25" />
          <path d="M9 7H8V6H9V7Z" fill="black" fillOpacity="0.25" />
          <path d="M7 5H6V4H7V5Z" fill="black" fillOpacity="0.25" />
          <path d="M3 7H2V8H1V6H2V5H3V7Z" fill="white" fillOpacity="0.4" />
          <path d="M11 6H10V5H11V6Z" fill="white" fillOpacity="0.4" />
          <path d="M10 5H9V4H10V5Z" fill="white" fillOpacity="0.4" />
          <path d="M9 4H8V3H9V4Z" fill="white" fillOpacity="0.4" />
        </>
      )}

      {/* Variant: On */}
      {variant === 'on' && (
        <>
          <path d="M6 6H5V5H6V6Z" fill="#808080" />
          <path d="M9 4H10V5H11V11H9V10H10V6H9V5H8V4H7V3H9V4Z" fill="#FAECD1" />
          <path d="M7 3H6V2H7V3Z" fill="#FAECD1" />
          <path
            d="M5 5H4V6H5V7H6V6H7V5H8V6H9V7H8V8H7V9H6V10H5V11H4V10H3V9H2V8H1V6H2V5H3V4H4V3H5V5Z"
            fill="#27AE60"
          />
          <path d="M7 5H6V4H7V5Z" fill="#27AE60" />
          <path d="M5 12H4V11H5V12Z" fill="black" fillOpacity="0.8" />
          <path
            d="M12 12H8V10H9V11H11V5H12V12Z"
            fill="black"
            fillOpacity="0.8"
          />
          <path d="M4 11H3V10H4V11Z" fill="black" fillOpacity="0.8" />
          <path d="M6 11H5V10H6V11Z" fill="black" fillOpacity="0.8" />
          <path d="M3 10H2V9H3V10Z" fill="black" fillOpacity="0.8" />
          <path d="M7 10H6V9H7V10Z" fill="black" fillOpacity="0.8" />
          <path d="M10 10H9V8H8V7H9V6H10V10Z" fill="black" fillOpacity="0.8" />
          <path d="M2 9H1V8H2V9Z" fill="black" fillOpacity="0.8" />
          <path d="M8 9H7V8H8V9Z" fill="black" fillOpacity="0.8" />
          <path d="M1 8H0V6H1V8Z" fill="black" fillOpacity="0.8" />
          <path d="M6 7H5V6H6V7Z" fill="black" fillOpacity="0.8" />
          <path d="M2 4H3V5H2V6H1V1H2V4Z" fill="black" fillOpacity="0.8" />
          <path d="M5 6H4V5H5V6Z" fill="black" fillOpacity="0.8" />
          <path d="M7 6H6V5H7V6Z" fill="black" fillOpacity="0.8" />
          <path d="M9 6H8V5H9V6Z" fill="black" fillOpacity="0.8" />
          <path
            d="M6 1H7V2H6V3H7V4H6V5H5V3H4V2H5V1H2V0H6V1Z"
            fill="black"
            fillOpacity="0.8"
          />
          <path d="M8 5H7V4H8V5Z" fill="black" fillOpacity="0.8" />
          <path d="M11 5H10V4H11V5Z" fill="black" fillOpacity="0.8" />
          <path d="M4 4H3V3H4V4Z" fill="black" fillOpacity="0.8" />
          <path d="M10 4H9V3H10V4Z" fill="black" fillOpacity="0.8" />
          <path d="M9 3H7V2H9V3Z" fill="black" fillOpacity="0.8" />
          <path d="M5 11H4V10H5V11Z" fill="black" fillOpacity="0.3" />
          <path d="M11 11H9V10H11V11Z" fill="black" fillOpacity="0.3" />
          <path d="M6 10H5V9H6V10Z" fill="black" fillOpacity="0.3" />
          <path d="M7 9H6V8H7V9Z" fill="black" fillOpacity="0.3" />
          <path d="M8 8H7V7H8V8Z" fill="black" fillOpacity="0.3" />
          <path d="M9 7H8V6H9V7Z" fill="black" fillOpacity="0.3" />
          <path d="M7 5H6V4H7V5Z" fill="black" fillOpacity="0.3" />
          <path d="M3 7H2V8H1V6H2V5H3V7Z" fill="white" fillOpacity="0.5" />
          <path d="M11 6H10V5H11V6Z" fill="white" fillOpacity="0.5" />
          <path d="M10 5H9V4H10V5Z" fill="white" fillOpacity="0.5" />
          <path d="M9 4H8V3H9V4Z" fill="white" fillOpacity="0.5" />
        </>
      )}
    </svg>
  );
}
