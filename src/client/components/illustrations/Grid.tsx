import type { IllustrationProps } from './types';

type variant = 'on' | 'off';

export function Grid({
  size = 12,
  title = 'Grid',
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
      aria-label={`${variant} grid`}
      role="img"
      {...props}
    >
      {/* Variant: Off */}
      {variant === 'off' && (
        <>
          <path
            d="M10 12H2V11H10V12Z M2 11H1V10H2V11Z M11 11H10V10H11V11Z M1 10H0V2H1V10Z M12 10H11V2H12V10Z M2 2H1V1H2V2Z M11 2H10V1H11V2Z M10 1H2V0H10V1Z"
            fill="black"
            fillOpacity="0.5"
          />

          <path
            d="M5 11H3V9H5V11Z M9 11H7V9H9V11Z M3 9H1V7H3V9Z M7 9H5V7H7V9Z M11 9H9V7H11V9Z M5 7H3V5H5V7Z M9 7H7V5H9V7Z M3 5H1V3H3V5Z M7 5H5V3H7V5Z M11 5H9V3H11V5Z M5 3H3V1H5V3Z M9 3H7V1H9V3Z"
            fill="black"
            fillOpacity="0.2"
          />

          <path
            d="M3 9V11H2V10H1V9H3Z M7 11H5V9H7V11Z M11 10H10V11H9V9H11V10Z M5 9H3V7H5V9Z M9 9H7V7H9V9Z M3 7H1V5H3V7Z M7 7H5V5H7V7Z M11 7H9V5H11V7Z M5 5H3V3H5V5Z M9 5H7V3H9V5Z M3 3H1V2H2V1H3V3Z M7 3H5V1H7V3Z M10 2H11V3H9V1H10V2Z"
            fill="white"
            fillOpacity="0.2"
          />
        </>
      )}

      {/* Variant: On */}
      {variant === 'on' && (
        <>
          <path d="M10 2H11V10H10V11H2V10H1V2H2V1H10V2Z" fill="#FAECD1" />
          <path
            d="M10 12H2V11H10V12Z M2 11H1V10H2V11Z M11 11H10V10H11V11Z M1 10H0V2H1V10Z M12 10H11V2H12V10Z M2 2H1V1H2V2Z M11 2H10V1H11V2Z M10 1H2V0H10V1Z"
            fill="black"
            fillOpacity="0.8"
          />
          <path
            d="M5 11H3V9H5V11Z M9 11H7V9H9V11Z M3 9H1V7H3V9Z M7 9H5V7H7V9Z M11 9H9V7H11V9Z M5 7H3V5H5V7Z M9 7H7V5H9V7Z M3 5H1V3H3V5Z M7 5H5V3H7V5Z M11 5H9V3H11V5Z M5 3H3V1H5V3Z M9 3H7V1H9V3Z"
            fill="black"
            fillOpacity="0.3"
          />
          <path
            d="M3 9V11H2V10H1V9H3Z M7 11H5V9H7V11Z M11 10H10V11H9V9H11V10Z M5 9H3V7H5V9Z M9 9H7V7H9V9Z M3 7H1V5H3V7Z M7 7H5V5H7V7Z M11 7H9V5H11V7Z M5 5H3V3H5V5Z M9 5H7V3H9V5Z M3 3H1V2H2V1H3V3Z M7 3H5V1H7V3Z M10 2H11V3H9V1H10V2Z"
            fill="white"
            fillOpacity="0.5"
          />
        </>
      )}
    </svg>
  );
}
