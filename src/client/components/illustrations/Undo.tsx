import type { IllustrationProps } from './types';

type variant = 'on' | 'off';

const ACCENT_COLOR = '#FF4500';

export function Undo({
  size = 12,
  title = 'Undo',
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
      aria-label={`${variant} undo`}
      role="img"
      {...props}
    >
      {/* Variant: Off */}
      {variant === 'off' && (
        <>
          <path
            d="M5 11H4V10H5V11Z M11 11H10V10H11V11Z M4 10H3V9H4V10Z M6 5H7V7H6V10H5V2H6V5Z M10 10H9V9H10V10Z M12 10H11V2H12V10Z M3 9H2V8H3V9Z M9 9H8V8H9V9Z M2 8H1V7H2V8Z M8 8H7V7H8V8Z M1 7H0V5H1V7Z M2 5H1V4H2V5Z M8 5H7V4H8V5Z M3 4H2V3H3V4Z M9 4H8V3H9V4Z M4 3H3V2H4V3Z M10 3H9V2H10V3Z M5 2H4V1H5V2Z M11 2H10V1H11V2Z"
            fill="black"
            fillOpacity="0.5"
          />
          <path
            d="M5 10H4V9H3V8H2V7H1V5H2V4H3V3H4V2H5V10Z M11 10H10V9H9V8H8V7H7V5H8V4H9V3H10V2H11V10Z"
            fill="white"
            fillOpacity="0.4"
          />
          <path
            d="M5 10H4V2H5V10Z M11 10H10V2H11V10Z"
            fill="black"
            fillOpacity="0.25"
          />
          <path
            d="M2 7H1V5H2V7Z M8 7H7V5H8V7Z M3 5H2V4H3V5Z M9 5H8V4H9V5Z"
            fill="white"
            fillOpacity="0.4"
          />
        </>
      )}

      {/* Variant: On */}
      {variant === 'on' && (
        <>
          <path
            d="M5 11H4V10H5V11Z M11 11H10V10H11V11Z M4 10H3V9H4V10Z M6 5H7V7H6V10H5V2H6V5Z M10 10H9V9H10V10Z M12 10H11V2H12V10Z M3 9H2V8H3V9Z M9 9H8V8H9V9Z M2 8H1V7H2V8Z M8 8H7V7H8V8Z M1 7H0V5H1V7Z M2 5H1V4H2V5Z M8 5H7V4H8V5Z M3 4H2V3H3V4Z M9 4H8V3H9V4Z M4 3H3V2H4V3Z M10 3H9V2H10V3Z M5 2H4V1H5V2Z M11 2H10V1H11V2Z"
            fill="black"
            fillOpacity="0.8"
          />
          <path
            d="M5 10H4V9H3V8H2V7H1V5H2V4H3V3H4V2H5V10Z M11 10H10V9H9V8H8V7H7V5H8V4H9V3H10V2H11V10Z"
            fill={ACCENT_COLOR}
          />
          <path
            d="M5 10H4V2H5V10Z M11 10H10V2H11V10Z"
            fill="black"
            fillOpacity="0.3"
          />
          <path
            d="M2 7H1V5H2V7Z M8 7H7V5H8V7Z M3 5H2V4H3V5Z M9 5H8V4H9V5Z"
            fill="white"
            fillOpacity="0.5"
          />
        </>
      )}
    </svg>
  );
}
