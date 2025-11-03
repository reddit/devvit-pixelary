import type { IllustrationProps } from './types';

type MultiplierVariant = 'double' | 'triple';

export function Multiplier({
  variant = 'double',
  size = 12,
  title,
  className = '',
  ...props
}: IllustrationProps & { variant?: MultiplierVariant }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={
        title ?? (variant === 'double' ? '2x multiplier' : '3x multiplier')
      }
      role="img"
      {...props}
    >
      {variant === 'double' ? (
        <>
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M11 2H12V6H11V7H10V8H12V11H6V10H4V9H3V10H0V7H1V6H0V3H3V4H4V3H6V2H7V1H11V2ZM8 3H7V4H8V3H10V5H9V6H8V7H7V10H11V9H8V7H9V6H10V5H11V3H10V2H8V3ZM5 5H4V6H3V5H2V6H3V7H2V8H1V9H2V8H3V7H4V8H5V7H4V6H5V5H6V4H5V5ZM5 9H6V8H5V9ZM1 4V5H2V4H1Z"
            fill="black"
            fillOpacity="0.8"
          />
          <path
            d="M8 9H11V10H7V7H8V9ZM9 7H8V6H9V7ZM10 6H9V5H10V6ZM11 5H10V3H11V5ZM8 4H7V3H8V4ZM10 3H8V2H10V3Z"
            fill="#F2C94C"
          />
          <path
            d="M2 9H1V8H2V9ZM6 9H5V8H6V9ZM3 8H2V7H3V8ZM5 8H4V7H5V8ZM4 7H3V6H4V7ZM3 6H2V5H3V6ZM5 6H4V5H5V6ZM2 5H1V4H2V5ZM6 5H5V4H6V5Z"
            fill="#FAECD1"
          />
        </>
      ) : (
        <>
          <path
            d="M10 9V10H8V9H10ZM8 9H7V8H8V9ZM11 9H10V7H11V9ZM10 7H9V5H10V7ZM11 5H10V3H11V5ZM8 4H7V3H8V4ZM10 3H8V2H10V3Z"
            fill="#EB5757"
          />
          <path
            d="M2 9H1V8H2V9ZM6 9H5V8H6V9ZM3 8H2V7H3V8ZM5 8H4V7H5V8ZM4 7H3V6H4V7ZM3 6H2V5H3V6ZM5 6H4V5H5V6ZM2 5H1V4H2V5ZM6 5H5V4H6V5Z"
            fill="#FAECD1"
          />
          <path
            d="M11 2H12V10H11V11H7V10H4V9H3V10H0V7H1V6H0V3H3V4H4V3H6V2H7V1H11V2ZM10 9H8V8H7V9H8V10H10V9H11V7H10V9ZM5 5H4V6H3V5H2V6H3V7H2V8H1V9H2V8H3V7H4V8H5V7H4V6H5V5H6V4H5V5ZM5 9H6V8H5V9ZM7 6H6V7H8V5H7V6ZM8 3H7V4H8V3H10V5H9V7H10V5H11V3H10V2H8V3ZM1 5H2V4H1V5Z"
            fill="black"
            fillOpacity="0.8"
          />
        </>
      )}
    </svg>
  );
}
