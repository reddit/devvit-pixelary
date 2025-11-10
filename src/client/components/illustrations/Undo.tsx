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
          <path
            d="M3 3H4V2H5V1H9V2H10V3H11V9H10V10H9V11H3V9H8V8H9V4H8V3H6V4H5V5H7V7H1V1H3V3Z"
            fill="white"
            fillOpacity="0.4"
          />
          <path d="M9 12H3V11H9V12Z" fill="black" fillOpacity="0.5" />
          <path d="M3 11H2V9H3V11Z" fill="black" fillOpacity="0.5" />
          <path d="M10 11H9V10H10V11Z" fill="black" fillOpacity="0.5" />
          <path d="M11 10H10V9H11V10Z" fill="black" fillOpacity="0.5" />
          <path
            d="M3 1H1V7H7V5H8V4H9V8H8V9H3V8H0V0H3V1Z"
            fill="black"
            fillOpacity="0.5"
          />
          <path d="M12 9H11V3H12V9Z" fill="black" fillOpacity="0.5" />
          <path d="M8 4H7V5H5V4H6V3H8V4Z" fill="black" fillOpacity="0.5" />
          <path d="M5 2H4V3H3V1H5V2Z" fill="black" fillOpacity="0.5" />
          <path d="M11 3H10V2H11V3Z" fill="black" fillOpacity="0.5" />
          <path d="M10 2H9V1H10V2Z" fill="black" fillOpacity="0.5" />
          <path d="M9 1H5V0H9V1Z" fill="black" fillOpacity="0.5" />
          <path d="M3 2H2V5H1V1H3V2Z" fill="white" fillOpacity="0.4" />
          <path d="M5 3H4V2H5V3Z" fill="white" fillOpacity="0.4" />
          <path d="M9 2H5V1H9V2Z" fill="white" fillOpacity="0.4" />
          <path d="M9 11H3V10H9V11Z" fill="black" fillOpacity="0.25" />
          <path d="M10 10H9V9H10V10Z" fill="black" fillOpacity="0.25" />
          <path d="M11 9H10V3H11V9Z" fill="black" fillOpacity="0.25" />
          <path d="M7 7H1V6H7V7Z" fill="black" fillOpacity="0.25" />
        </>
      )}

      {/* Variant: On */}
      {variant === 'on' && (
        <>
          <path
            d="M3 3H4V2H5V1H9V2H10V3H11V9H10V10H9V11H3V9H8V8H9V4H8V3H6V4H5V5H7V7H1V1H3V3Z"
            fill="#27AE60"
          />
          <path d="M9 12H3V11H9V12Z" fill="black" fillOpacity="0.8" />
          <path d="M3 11H2V9H3V11Z" fill="black" fillOpacity="0.8" />
          <path d="M10 11H9V10H10V11Z" fill="black" fillOpacity="0.8" />
          <path d="M11 10H10V9H11V10Z" fill="black" fillOpacity="0.8" />
          <path
            d="M3 1H1V7H7V5H8V4H9V8H8V9H3V8H0V0H3V1Z"
            fill="black"
            fillOpacity="0.8"
          />
          <path d="M12 9H11V3H12V9Z" fill="black" fillOpacity="0.8" />
          <path d="M8 4H7V5H5V4H6V3H8V4Z" fill="black" fillOpacity="0.8" />
          <path d="M5 2H4V3H3V1H5V2Z" fill="black" fillOpacity="0.8" />
          <path d="M11 3H10V2H11V3Z" fill="black" fillOpacity="0.8" />
          <path d="M10 2H9V1H10V2Z" fill="black" fillOpacity="0.8" />
          <path d="M9 1H5V0H9V1Z" fill="black" fillOpacity="0.8" />
          <path d="M3 2H2V5H1V1H3V2Z" fill="white" fillOpacity="0.5" />
          <path d="M5 3H4V2H5V3Z" fill="white" fillOpacity="0.5" />
          <path d="M9 2H5V1H9V2Z" fill="white" fillOpacity="0.5" />
          <path d="M9 11H3V10H9V11Z" fill="black" fillOpacity="0.3" />
          <path d="M10 10H9V9H10V10Z" fill="black" fillOpacity="0.3" />
          <path d="M11 9H10V3H11V9Z" fill="black" fillOpacity="0.3" />
          <path d="M7 7H1V6H7V7Z" fill="black" fillOpacity="0.3" />
        </>
      )}
    </svg>
  );
}
