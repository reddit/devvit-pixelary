import type { IllustrationProps } from './types';

type direction = 'vertical' | 'horizontal';
type variant = 'on' | 'off';

const ACCENT_COLOR = '#FF4500';
const MIRROR_COLOR = '#C0C0C0';

export function Mirror({
  size = 12,
  title = 'Mirror',
  className = '',
  direction = 'vertical',
  variant = 'on',
  ...props
}: IllustrationProps & {
  direction?: direction;
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
      aria-label={`${direction} mirror`}
      role="img"
      {...props}
    >
      {/* Vertical, Variant: Off */}
      {direction === 'vertical' && variant === 'off' && (
        <>
          <path
            d="M9 12H3V11H9V12Z M3 11H2V10H3V11Z M10 11H9V10H10V11Z M4 10H3V9H4V10Z M9 10H8V9H9V10Z M11 8H8V9H7V8H5V9H4V8H1V7H11V8Z M1 7H0V5H1V7Z M12 7H11V5H12V7Z M11 5H1V4H4V3H5V4H7V3H8V4H11V5Z M4 3H3V2H4V3Z M9 3H8V2H9V3Z M3 2H2V1H3V2Z M10 2H9V1H10V2Z M9 1H3V0H9V1Z"
            fill="black"
            fillOpacity="0.5"
          />
          <path
            d="M7 9H8V10H9V11H3V10H4V9H5V8H7V9Z M9 2H8V3H7V4H5V3H4V2H3V1H9V2Z  M11 7H1V5H11V7Z M7 9H5V8H7V9Z M7 4H5V3H7V4Z"
            fill="white"
            fillOpacity="0.4"
          />
          <path
            d="M9 11H3V10H9V11Z M11 7H2V6H11V7Z M9 2H3V1H9V2Z"
            fill="black"
            fillOpacity="0.25"
          />
        </>
      )}

      {/* Vertical, Variant: On */}
      {direction === 'vertical' && variant === 'on' && (
        <>
          <path
            d="M9 12H3V11H9V12Z M3 11H2V10H3V11Z M10 11H9V10H10V11Z M4 10H3V9H4V10Z M9 10H8V9H9V10Z M11 8H8V9H7V8H5V9H4V8H1V7H11V8Z M1 7H0V5H1V7Z M12 7H11V5H12V7Z M11 5H1V4H4V3H5V4H7V3H8V4H11V5Z M4 3H3V2H4V3Z M9 3H8V2H9V3Z M3 2H2V1H3V2Z M10 2H9V1H10V2Z M9 1H3V0H9V1Z"
            fill="black"
            fillOpacity="0.8"
          />
          <path
            d="M7 9H8V10H9V11H3V10H4V9H5V8H7V9Z M9 2H8V3H7V4H5V3H4V2H3V1H9V2Z"
            fill={ACCENT_COLOR}
          />
          <path d="M11 7H1V5H11V7Z" fill={MIRROR_COLOR} />
          <path
            d="M7 9H5V8H7V9Z M7 4H5V3H7V4Z"
            fill="white"
            fillOpacity="0.5"
          />
          <path
            d="M9 11H3V10H9V11Z M11 7H2V6H11V7Z M9 2H3V1H9V2Z"
            fill="black"
            fillOpacity="0.3"
          />
        </>
      )}

      {/* Horizontal, Variant: Off */}
      {direction === 'horizontal' && variant === 'off' && (
        <>
          <path
            d="M7 12H5V11H7V12Z M5 11H4V8H3V7H4V5H3V4H4V1H5V11Z M8 4H9V5H8V7H9V8H8V11H7V1H8V4Z M2 10H1V9H2V10Z M11 10H10V9H11V10Z M1 9H0V3H1V9Z M3 9H2V8H3V9Z M10 9H9V8H10V9Z M12 9H11V3H12V9Z M3 4H2V3H3V4Z M10 4H9V3H10V4Z M2 3H1V2H2V3Z M11 3H10V2H11V3Z M7 1H5V0H7V1Z"
            fill="black"
            fillOpacity="0.5"
          />
          <path
            d="M2 4H3V5H4V7H3V8H2V9H1V3H2V4Z M11 9H10V8H9V7H8V5H9V4H10V3H11V9Z M7 11H5V1H7V11Z"
            fill="white"
            fillOpacity="0.4"
          />
          <path
            d="M7 11H6V2H7V11Z M2 9H1V3H2V9Z M11 9H10V3H11V9Z"
            fill="black"
            fillOpacity="0.25"
          />
          <path
            d="M4 7H3V5H4V7Z M9 7H8V5H9V7Z"
            fill="white"
            fillOpacity="0.4"
          />
        </>
      )}

      {/* Horizontal, Variant: On */}
      {direction === 'horizontal' && variant === 'on' && (
        <>
          <path
            d="M7 12H5V11H7V12Z M5 11H4V8H3V7H4V5H3V4H4V1H5V11Z M8 4H9V5H8V7H9V8H8V11H7V1H8V4Z M2 10H1V9H2V10Z M11 10H10V9H11V10Z M1 9H0V3H1V9Z M3 9H2V8H3V9Z M10 9H9V8H10V9Z M12 9H11V3H12V9Z M3 4H2V3H3V4Z M10 4H9V3H10V4Z M2 3H1V2H2V3Z M11 3H10V2H11V3Z M7 1H5V0H7V1Z"
            fill="black"
            fillOpacity="0.8"
          />
          <path
            d="M2 4H3V5H4V7H3V8H2V9H1V3H2V4Z M11 9H10V8H9V7H8V5H9V4H10V3H11V9Z"
            fill={ACCENT_COLOR}
          />
          <path d="M7 11H5V1H7V11Z" fill={MIRROR_COLOR} />
          <path
            d="M7 11H6V2H7V11Z M2 9H1V3H2V9Z M11 9H10V3H11V9Z"
            fill="black"
            fillOpacity="0.3"
          />
          <path
            d="M4 7H3V5H4V7Z M9 7H8V5H9V7Z"
            fill="white"
            fillOpacity="0.5"
          />
        </>
      )}
    </svg>
  );
}
