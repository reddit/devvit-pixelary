import type { HEX } from '@src/shared/types';
import type { IllustrationProps } from './types';

export function PaintSwatch({
  size = 12,
  title = 'Paint Swatch',
  color = `#FF4500`,
  className = '',
  ...props
}: IllustrationProps & { color?: HEX }) {
  return (
    <svg
      fill="none"
      height={size}
      viewBox="0 0 12 12"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      className={className}
      aria-label={title}
      role="img"
      {...props}
    >
      <path
        d="M7 12H5V11H7V12Z M5 11H3V10H5V11Z M9 11H7V10H9V11Z M3 10H2V9H3V10Z M10 10H9V9H10V10Z M2 9H1V7H2V9Z M11 9H10V7H11V9Z M1 7H0V5H1V7Z M12 7H11V5H12V7Z M2 5H1V3H2V5Z M11 5H10V3H11V5Z M3 3H2V2H3V3Z M10 3H9V2H10V3Z M5 2H3V1H5V2Z M9 2H7V1H9V2Z M7 1H5V0H7V1Z"
        fill="black"
        fillOpacity="0.8"
      />
      <path
        d="M7 2H9V3H10V5H11V7H10V9H9V10H7V11H5V10H3V9H2V7H1V5H2V3H3V2H5V1H7V2Z"
        fill={color}
      />
      <path
        d="M3 4H2V3H3V4Z M5 3H3V2H5V3Z M7 2H5V1H7V2Z"
        fill="white"
        fillOpacity="0.5"
      />
      <path
        d="M7 11H5V10H7V11Z M9 10H7V9H9V10Z M10 9H9V8H10V9Z"
        fill="black"
        fillOpacity="0.3"
      />
    </svg>
  );
}
