import type { IllustrationProps } from './types';

type variant = 'on' | 'off';

const ACCENT_COLOR = '#FF4500';

export function Redo({
  size = 12,
  title = 'Redo',
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
      aria-label={`${variant} redo`}
      role="img"
      {...props}
    >
      {/* Variant: Off */}
      {variant === 'off' && (
        <>
          <path
            d="M2 11H1V10H2V11Z M8 11H7V10H8V11Z M1 10H0V2H1V10Z M3 10H2V9H3V10Z M7 10H6V7H5V5H6V2H7V10Z M9 10H8V9H9V10Z M4 9H3V8H4V9Z M10 9H9V8H10V9Z M5 8H4V7H5V8Z M11 8H10V7H11V8Z M12 7H11V5H12V7Z M5 5H4V4H5V5Z M11 5H10V4H11V5Z M4 4H3V3H4V4Z M10 4H9V3H10V4Z M3 3H2V2H3V3Z M9 3H8V2H9V3Z M2 2H1V1H2V2Z M8 2H7V1H8V2Z"
            fill="black"
            fillOpacity="0.5"
          />
          <path
            d="M2 3H3V4H4V5H5V7H4V8H3V9H2V10H1V2H2V3Z M8 3H9V4H10V5H11V7H10V8H9V9H8V10H7V2H8V3Z"
            fill="white"
            fillOpacity="0.4"
          />
          <path
            d="M2 10H1V2H2V10Z M8 10H7V2H8V10Z"
            fill="black"
            fillOpacity="0.25"
          />
          <path
            d="M4 8H3V7H4V8Z M10 8H9V7H10V8Z M5 7H4V5H5V7Z M11 7H10V5H11V7Z"
            fill="white"
            fillOpacity="0.4"
          />
        </>
      )}

      {/* Variant: On */}
      {variant === 'on' && (
        <>
          <path
            d="M2 11H1V10H2V11Z M8 11H7V10H8V11Z M1 10H0V2H1V10Z M3 10H2V9H3V10Z M7 10H6V7H5V5H6V2H7V10Z M9 10H8V9H9V10Z M4 9H3V8H4V9Z M10 9H9V8H10V9Z M5 8H4V7H5V8Z M11 8H10V7H11V8Z M12 7H11V5H12V7Z M5 5H4V4H5V5Z M11 5H10V4H11V5Z M4 4H3V3H4V4Z M10 4H9V3H10V4Z M3 3H2V2H3V3Z M9 3H8V2H9V3Z M2 2H1V1H2V2Z M8 2H7V1H8V2Z"
            fill="black"
            fillOpacity="0.8"
          />
          <path
            d="M2 3H3V4H4V5H5V7H4V8H3V9H2V10H1V2H2V3Z M8 3H9V4H10V5H11V7H10V8H9V9H8V10H7V2H8V3Z"
            fill={ACCENT_COLOR}
          />
          <path
            d="M2 10H1V2H2V10Z M8 10H7V2H8V10Z"
            fill="black"
            fillOpacity="0.3"
          />
          <path
            d="M4 8H3V7H4V8Z M10 8H9V7H10V8Z M5 7H4V5H5V7Z M11 7H10V5H11V7Z"
            fill="white"
            fillOpacity="0.5"
          />
        </>
      )}
    </svg>
  );
}
